"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/providers/SessionProvider";
import { useLocalStore } from "./useLocalStore";
import InvoicingHistory from "./InvoicingHistory";
import {
  AGENT_COLORS,
  AGENT_SUGGESTIONS,
  CARRIER_SUGGESTIONS,
  CONTAINER_TYPE_SUGGESTIONS,
  EBS_STORAGE_KEY,
  Ebs,
  INVOICED_BLS_KEY,
  InvoiceHistoryEntry,
  InvoiceHistoryRow,
  InvoicedBL,
  InvoicedBLsRegistry,
  RATES_STORAGE_KEY,
  Rate,
  SEED_EBS,
  SEED_RATES,
  invoiceHistoryKey,
  uid,
} from "./constants";

type Row = Record<string, unknown>;

type ProcessedRow = {
  blNumber: string;
  etd: string;
  agent: string;
  carrier: string;
  route: string;
  tipo: string;
  bls: number;
  ctrs: number;
  sf: number | string;
  blFee: number | string;
  af: number | string;
  ebs: number | string;
  total: number | string;
  notes: string;
  pending: Set<string>;
  duplicate?: InvoicedBL;
};

type FilterMode = "all" | "rows" | "etd";

const PENDING_TOKENS = new Set(["TBD", "N/A", "NA", "PENDIENTE", "?"]);

function isPending(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  const s = String(value).trim().toUpperCase();
  return PENDING_TOKENS.has(s);
}

function normalizeWithList(value: unknown, list: readonly string[]): string {
  const s = String(value ?? "").trim();
  const match = list.find((a) => a.toLowerCase() === s.toLowerCase());
  return match ?? s;
}

function pickField(row: Row, keys: string[]): unknown {
  const normalized: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    normalized[k.toLowerCase().replace(/[\s_#.()-]/g, "")] = row[k];
  }
  for (const k of keys) {
    const nk = k.toLowerCase().replace(/[\s_#.()-]/g, "");
    if (nk in normalized) return normalized[nk];
  }
  return undefined;
}

function parseDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") {
    try {
      const d = XLSX.SSF.parse_date_code(value);
      if (!d) return "";
      const y = String(d.y).padStart(4, "0");
      const m = String(d.m).padStart(2, "0");
      const day = String(d.d).padStart(2, "0");
      return `${y}-${m}-${day}`;
    } catch {
      return "";
    }
  }
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }
  return "";
}

function findRate(
  rates: Rate[],
  agent: string,
  carrier: string,
  tipo: string,
  route: string
): Rate | undefined {
  return rates.find(
    (r) =>
      r.agent.toLowerCase() === agent.toLowerCase() &&
      r.carrier.toLowerCase() === carrier.toLowerCase() &&
      r.tipo.toLowerCase() === tipo.toLowerCase() &&
      (!route || r.route.toLowerCase() === route.toLowerCase())
  );
}

function findEbs(ebs: Ebs[], carrier: string): Ebs | undefined {
  return ebs.find((e) => e.carrier.toLowerCase() === carrier.toLowerCase());
}

function teuMultiplier(tipo: string): number {
  return tipo.startsWith("40") ? 2 : 1;
}

function processRows(rows: Row[], rates: Rate[], ebs: Ebs[]): ProcessedRow[] {
  return rows.map((row) => {
    const blNumber = String(
      pickField(row, ["blNumber", "bl", "blNro", "booking", "bookingNumber", "reference", "ref"]) ?? ""
    ).trim();
    const etd = parseDate(pickField(row, ["etd", "zarpe", "fechaZarpe", "etdDate", "fechaEtd"]));
    const agent = normalizeWithList(pickField(row, ["agent", "agente"]), AGENT_SUGGESTIONS);
    const carrier = normalizeWithList(
      pickField(row, ["carrier", "naviera"]),
      CARRIER_SUGGESTIONS
    );
    const tipo = normalizeWithList(
      pickField(row, ["tipo", "type", "ctrType"]),
      CONTAINER_TYPE_SUGGESTIONS
    );
    const route = String(pickField(row, ["route", "ruta"]) ?? "");
    const blsRaw = pickField(row, ["bls", "cantidadBls", "qtyBls"]);
    const ctrsRaw = pickField(row, ["ctrs", "ctr", "cantidadCtrs", "contenedores"]);
    const notes = String(pickField(row, ["notes", "notas", "observaciones"]) ?? "");

    const bls = Number(blsRaw) || (blNumber ? 1 : 0);
    const ctrs = Number(ctrsRaw) || 0;

    const pending = new Set<string>();

    if (isPending(agent)) pending.add("agent");
    if (isPending(carrier)) pending.add("carrier");
    if (isPending(tipo)) pending.add("tipo");
    if (isPending(blsRaw)) pending.add("bls");
    if (isPending(ctrsRaw)) pending.add("ctrs");

    const rate = findRate(rates, agent, carrier, tipo, route);
    const ebsRow = findEbs(ebs, carrier);

    let sf: number | string = "TBD";
    let blFee: number | string = "TBD";
    let af: number | string = "TBD";
    let ebsAmount: number | string = "TBD";

    if (rate) {
      sf = rate.sf * (ctrs || 0);
      blFee = rate.blFee * (bls || 0);
      const afCalc = rate.af * (ctrs || 0);
      af = rate.afMax > 0 ? Math.min(afCalc, rate.afMax) : afCalc;
    } else {
      pending.add("sf");
      pending.add("blFee");
      pending.add("af");
    }

    if (ebsRow) {
      ebsAmount = ebsRow.amountPerTEU * teuMultiplier(tipo) * (ctrs || 0);
    } else {
      pending.add("ebs");
    }

    let total: number | string = "TBD";
    if (
      typeof sf === "number" &&
      typeof blFee === "number" &&
      typeof af === "number" &&
      typeof ebsAmount === "number"
    ) {
      total = sf + blFee + af + ebsAmount;
    } else {
      pending.add("total");
    }

    return {
      blNumber,
      etd,
      agent,
      carrier,
      route,
      tipo,
      bls,
      ctrs,
      sf,
      blFee,
      af,
      ebs: ebsAmount,
      total,
      notes,
      pending,
    };
  });
}

function downloadExcel(processed: ProcessedRow[]) {
  const aoa = [
    [
      "BL",
      "ETD",
      "Agente",
      "Carrier",
      "Ruta",
      "Tipo",
      "BLs",
      "Ctrs",
      "SF",
      "BL Fee",
      "AF",
      "EBS",
      "Total",
      "Notas",
    ],
    ...processed.map((r) => [
      r.blNumber,
      r.etd,
      r.agent,
      r.carrier,
      r.route,
      r.tipo,
      r.bls,
      r.ctrs,
      r.sf,
      r.blFee,
      r.af,
      r.ebs,
      r.total,
      r.notes,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Facturación");
  const ts = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `facturacion-${ts}.xlsx`);
}

function loadInvoicedBls(): InvoicedBLsRegistry {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(INVOICED_BLS_KEY);
    return raw ? (JSON.parse(raw) as InvoicedBLsRegistry) : {};
  } catch {
    return {};
  }
}

function formatDuplicateDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function InvoicingTab() {
  const { session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const userId = session?.user?.id ?? "anonymous";
  const userName =
    session?.user
      ? `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim() ||
        session.user.id
      : "anónimo";

  const { items: rates, hydrated: ratesHydrated } = useLocalStore<Rate>(
    RATES_STORAGE_KEY,
    SEED_RATES
  );
  const { items: ebs, hydrated: ebsHydrated } = useLocalStore<Ebs>(
    EBS_STORAGE_KEY,
    SEED_EBS
  );

  const [fileName, setFileName] = useState<string>("");
  const [rawRows, setRawRows] = useState<Row[]>([]);
  const [processed, setProcessed] = useState<ProcessedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [rowFrom, setRowFrom] = useState<string>("");
  const [rowTo, setRowTo] = useState<string>("");
  const [etdFrom, setEtdFrom] = useState<string>("");
  const [etdTo, setEtdTo] = useState<string>("");

  const [historyRefresh, setHistoryRefresh] = useState(0);

  const filterSummary = useMemo(() => {
    if (filterMode === "rows") {
      const from = rowFrom || "1";
      const to = rowTo || String(rawRows.length || "");
      return `Filas ${from}–${to}`;
    }
    if (filterMode === "etd") {
      return `ETD ${etdFrom || "?"} a ${etdTo || "?"}`;
    }
    return "Todas las filas";
  }, [filterMode, rowFrom, rowTo, etdFrom, etdTo, rawRows.length]);

  const handleFile = async (file: File) => {
    setError(null);
    setProcessed(null);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const firstSheet = wb.SheetNames[0];
      if (!firstSheet) {
        setError("El archivo no contiene hojas.");
        return;
      }
      const ws = wb.Sheets[firstSheet];
      if (!ws) {
        setError("No se pudo leer la hoja.");
        return;
      }
      const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
      setRawRows(rows);
      setRowFrom("1");
      setRowTo(String(rows.length));
      setFilterMode("all");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al leer el archivo");
    }
  };

  const applyFilter = (rows: Row[]): Row[] => {
    if (filterMode === "rows") {
      const from = Math.max(1, Number(rowFrom) || 1);
      const to = Math.min(rows.length, Number(rowTo) || rows.length);
      if (from > to) return [];
      return rows.slice(from - 1, to);
    }
    if (filterMode === "etd") {
      return rows.filter((row) => {
        const etd = parseDate(
          pickField(row, ["etd", "zarpe", "fechaZarpe", "etdDate", "fechaEtd"])
        );
        if (!etd) return false;
        if (etdFrom && etd < etdFrom) return false;
        if (etdTo && etd > etdTo) return false;
        return true;
      });
    }
    return rows;
  };

  const handleProcess = () => {
    if (!rawRows.length) {
      setError("No hay filas para procesar. Subí un Excel primero.");
      return;
    }
    const filteredRows = applyFilter(rawRows);
    if (!filteredRows.length) {
      setError("El filtro no coincide con ninguna fila.");
      setProcessed([]);
      return;
    }
    setError(null);
    const currentBls = loadInvoicedBls();
    const rows = processRows(filteredRows, rates, ebs).map((r) => {
      if (r.blNumber && currentBls[r.blNumber]) {
        return { ...r, duplicate: currentBls[r.blNumber] };
      }
      return r;
    });
    setProcessed(rows);
  };

  const handleMarkInvoiced = () => {
    if (!processed?.length) return;
    const now = new Date().toISOString();
    const blsInThisInvoice: string[] = [];
    const updatedRegistry: InvoicedBLsRegistry = { ...loadInvoicedBls() };

    const historyRows: InvoiceHistoryRow[] = processed.map((r) => ({
      blNumber: r.blNumber,
      agent: r.agent,
      carrier: r.carrier,
      route: r.route,
      tipo: r.tipo,
      bls: r.bls,
      ctrs: r.ctrs,
      total: r.total,
    }));

    for (const row of processed) {
      if (!row.blNumber) continue;
      updatedRegistry[row.blNumber] = {
        bl: row.blNumber,
        invoicedAt: now,
        userId,
        userName,
      };
      blsInThisInvoice.push(row.blNumber);
    }

    try {
      window.localStorage.setItem(
        INVOICED_BLS_KEY,
        JSON.stringify(updatedRegistry)
      );
    } catch {
      // ignore quota
    }

    const entry: InvoiceHistoryEntry = {
      id: uid("inv"),
      invoicedAt: now,
      userId,
      userName,
      blCount: blsInThisInvoice.length,
      bls: blsInThisInvoice,
      rows: historyRows,
      filterSummary,
    };

    try {
      const key = invoiceHistoryKey(userId);
      const existing = JSON.parse(
        window.localStorage.getItem(key) ?? "[]"
      ) as InvoiceHistoryEntry[];
      existing.push(entry);
      window.localStorage.setItem(key, JSON.stringify(existing));
    } catch {
      // ignore quota
    }

    setHistoryRefresh((n) => n + 1);
    toast.success(
      blsInThisInvoice.length
        ? `${blsInThisInvoice.length} BL${blsInThisInvoice.length === 1 ? "" : "s"} marcado${blsInThisInvoice.length === 1 ? "" : "s"} como facturado${blsInThisInvoice.length === 1 ? "" : "s"}`
        : "Facturación guardada en el historial"
    );
  };

  const renderCell = (
    value: number | string,
    field: string,
    row: ProcessedRow
  ) => {
    const pendingCell = row.pending.has(field);
    const text =
      typeof value === "number" ? `$${value.toLocaleString("es-AR")}` : String(value);
    return (
      <td
        className={`px-4 py-2 whitespace-nowrap ${
          pendingCell ? "bg-yellow-200" : ""
        }`}
      >
        {text}
      </td>
    );
  };

  if (!ratesHydrated || !ebsHydrated) {
    return <div className="text-gray-500 py-8 text-center">Cargando...</div>;
  }

  const duplicateCount = processed?.filter((r) => r.duplicate).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
        <h3 className="font-semibold mb-3">Subir Excel de facturación</h3>
        <p className="text-xs text-gray-500 mb-3">
          Columnas esperadas: bl, etd, agente, carrier, ruta, tipo, bls, ctrs, notas.
        </p>

        <div
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          role="button"
          tabIndex={0}
          className={`cursor-pointer border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-blue-500 hover:bg-blue-50"
          }`}
        >
          {fileName ? (
            <div className="text-sm">
              <div className="font-medium text-gray-800">{fileName}</div>
              <div className="text-gray-500 mt-1">
                {rawRows.length} filas cargadas — hacé clic o soltá para cambiar
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              <div className="text-2xl mb-2">📊</div>
              <div className="font-medium">
                Hacé clic para elegir un Excel o arrastrá el archivo aquí
              </div>
              <div className="text-xs text-gray-500 mt-1">Formato: .xlsx o .xls</div>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="hidden"
        />

        {rawRows.length > 0 && (
          <div className="mt-4 border border-gray-200 rounded-md p-3 bg-gray-50">
            <div className="text-sm font-medium mb-2">Filtrar qué filas procesar</div>
            <div className="flex flex-col gap-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="filter-mode"
                  checked={filterMode === "all"}
                  onChange={() => setFilterMode("all")}
                />
                Todas las filas ({rawRows.length})
              </label>
              <label className="flex flex-wrap items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="filter-mode"
                  checked={filterMode === "rows"}
                  onChange={() => setFilterMode("rows")}
                />
                Por rango de filas: Desde
                <input
                  type="number"
                  min={1}
                  max={rawRows.length}
                  value={rowFrom}
                  onChange={(e) => setRowFrom(e.target.value)}
                  onClick={() => setFilterMode("rows")}
                  className="border border-gray-200 rounded-md p-1 h-8 w-20"
                />
                hasta
                <input
                  type="number"
                  min={1}
                  max={rawRows.length}
                  value={rowTo}
                  onChange={(e) => setRowTo(e.target.value)}
                  onClick={() => setFilterMode("rows")}
                  className="border border-gray-200 rounded-md p-1 h-8 w-20"
                />
              </label>
              <label className="flex flex-wrap items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="filter-mode"
                  checked={filterMode === "etd"}
                  onChange={() => setFilterMode("etd")}
                />
                Por fecha de zarpe (ETD): Desde
                <input
                  type="date"
                  value={etdFrom}
                  onChange={(e) => setEtdFrom(e.target.value)}
                  onClick={() => setFilterMode("etd")}
                  className="border border-gray-200 rounded-md p-1 h-8"
                />
                hasta
                <input
                  type="date"
                  value={etdTo}
                  onChange={(e) => setEtdTo(e.target.value)}
                  onClick={() => setFilterMode("etd")}
                  className="border border-gray-200 rounded-md p-1 h-8"
                />
              </label>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <Button onClick={handleProcess} disabled={!rawRows.length}>
            Procesar
          </Button>
          <Button
            variant="outline"
            disabled={!processed?.length}
            onClick={() => processed && downloadExcel(processed)}
          >
            Descargar Excel
          </Button>
          {processed && processed.length > 0 && (
            <Button onClick={handleMarkInvoiced}>
              Marcar como facturado ({processed.length})
            </Button>
          )}
        </div>

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        {processed && duplicateCount > 0 && (
          <div className="mt-3 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">
            ⚠️ {duplicateCount} BL{duplicateCount === 1 ? "" : "s"} ya había
            {duplicateCount === 1 ? "" : "n"} sido facturado
            {duplicateCount === 1 ? "" : "s"} previamente. Revisá las filas marcadas antes de continuar.
          </div>
        )}
      </div>

      {processed && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "BL",
                  "ETD",
                  "Agente",
                  "Carrier",
                  "Ruta",
                  "Tipo",
                  "BLs",
                  "Ctrs",
                  "SF",
                  "BL Fee",
                  "AF",
                  "EBS",
                  "Total",
                  "Notas",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {processed.map((r, idx) => {
                const agentColor = AGENT_COLORS[r.agent];
                return (
                  <Fragment key={idx}>
                    <tr
                      style={agentColor ? { backgroundColor: agentColor } : undefined}
                      className="text-sm"
                    >
                      <td className="px-4 py-2 font-mono whitespace-nowrap">
                        {r.blNumber || "—"}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-xs">
                        {r.etd || "—"}
                      </td>
                      <td
                        className={`px-4 py-2 font-medium whitespace-nowrap ${
                          r.pending.has("agent") ? "bg-yellow-200" : ""
                        }`}
                      >
                        {r.agent || "—"}
                      </td>
                      <td
                        className={`px-4 py-2 whitespace-nowrap ${
                          r.pending.has("carrier") ? "bg-yellow-200" : ""
                        }`}
                      >
                        {r.carrier || "—"}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{r.route || "—"}</td>
                      <td
                        className={`px-4 py-2 whitespace-nowrap ${
                          r.pending.has("tipo") ? "bg-yellow-200" : ""
                        }`}
                      >
                        {r.tipo || "—"}
                      </td>
                      <td
                        className={`px-4 py-2 whitespace-nowrap ${
                          r.pending.has("bls") ? "bg-yellow-200" : ""
                        }`}
                      >
                        {r.bls}
                      </td>
                      <td
                        className={`px-4 py-2 whitespace-nowrap ${
                          r.pending.has("ctrs") ? "bg-yellow-200" : ""
                        }`}
                      >
                        {r.ctrs}
                      </td>
                      {renderCell(r.sf, "sf", r)}
                      {renderCell(r.blFee, "blFee", r)}
                      {renderCell(r.af, "af", r)}
                      {renderCell(r.ebs, "ebs", r)}
                      {renderCell(r.total, "total", r)}
                      <td className="px-4 py-2 max-w-xs truncate">{r.notes}</td>
                    </tr>
                    {r.duplicate && (
                      <tr className="bg-yellow-100 text-xs">
                        <td
                          colSpan={14}
                          className="px-4 py-2 text-yellow-900 border-l-4 border-yellow-500"
                        >
                          ⚠️ Este BL ya fue facturado el{" "}
                          <strong>
                            {formatDuplicateDate(r.duplicate.invoicedAt)}
                          </strong>{" "}
                          por <strong>{r.duplicate.userName}</strong>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {processed.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No hay filas procesadas
            </div>
          )}
        </div>
      )}

      <InvoicingHistory
        currentUserId={userId}
        currentUserName={userName}
        isAdmin={isAdmin}
        refreshToken={historyRefresh}
      />
    </div>
  );
}
