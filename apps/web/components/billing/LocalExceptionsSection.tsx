"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useLocalStore } from "./useLocalStore";
import RateIntake from "./RateIntake";
import {
  CUSTOMER_COLORS,
  CUSTOMER_SUGGESTIONS,
  LOCAL_CARRIER_SUGGESTIONS,
  LOCAL_EXCEPTIONS_STORAGE_KEY,
  LocalException,
  LocalExceptionTipo,
  SEED_LOCAL_EXCEPTIONS,
  uid,
  uniqueSuggestions,
} from "./constants";

const emptyDraft: Omit<LocalException, "id"> = {
  customer: "",
  carrier: "",
  tipo: "Dry",
  othc: 0,
  sello: 0,
  ams: 0,
  blFee: 0,
  gateOut: 0,
  gateOutPorts: "",
  gateOutUnitTypes: "",
  otherCharges: 0,
  otherChargesDetail: "",
  notes: "",
  validFrom: "",
};

function toNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toStr(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function normalizeTipo(v: unknown): LocalExceptionTipo {
  const s = toStr(v).trim().toLowerCase();
  return s === "reefer" ? "Reefer" : "Dry";
}

function Chips({ value }: { value: string }) {
  if (!value.trim()) return <span className="text-gray-400">—</span>;
  const parts = value
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    return <span>{value}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p, i) => (
        <span
          key={i}
          className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 border border-gray-200 text-gray-700"
        >
          {p}
        </span>
      ))}
    </div>
  );
}

export default function LocalExceptionsSection() {
  const { items, add, update, remove, hydrated } = useLocalStore<LocalException>(
    LOCAL_EXCEPTIONS_STORAGE_KEY,
    SEED_LOCAL_EXCEPTIONS
  );

  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<LocalException, "id">>(emptyDraft);
  const [showIntake, setShowIntake] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const customerSuggestions = useMemo(
    () => uniqueSuggestions(items.map((r) => r.customer), CUSTOMER_SUGGESTIONS),
    [items]
  );
  const carrierSuggestions = useMemo(
    () => uniqueSuggestions(items.map((r) => r.carrier), LOCAL_CARRIER_SUGGESTIONS),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const cu = customerFilter.toLowerCase().trim();
    const ca = carrierFilter.toLowerCase().trim();
    return items.filter((r) => {
      if (cu && !r.customer.toLowerCase().includes(cu)) return false;
      if (ca && !r.carrier.toLowerCase().includes(ca)) return false;
      if (!q) return true;
      return (
        r.customer.toLowerCase().includes(q) ||
        r.carrier.toLowerCase().includes(q) ||
        r.tipo.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q) ||
        r.otherChargesDetail.toLowerCase().includes(q)
      );
    });
  }, [items, search, customerFilter, carrierFilter]);

  const openNew = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setShowIntake(true);
    setShowForm(false);
  };

  const openEdit = (row: LocalException) => {
    const { id: _id, ...rest } = row;
    void _id;
    setDraft(rest);
    setEditingId(row.id);
    setShowIntake(false);
    setShowForm(true);
  };

  const handleExtracted = (data: Record<string, unknown>) => {
    setDraft({
      customer: toStr(data.customer),
      carrier: toStr(data.carrier),
      tipo: normalizeTipo(data.tipo),
      othc: toNumber(data.othc),
      sello: toNumber(data.sello),
      ams: toNumber(data.ams),
      blFee: toNumber(data.blFee),
      gateOut: toNumber(data.gateOut),
      gateOutPorts: toStr(data.gateOutPorts),
      gateOutUnitTypes: toStr(data.gateOutUnitTypes),
      otherCharges: toNumber(data.otherCharges),
      otherChargesDetail: toStr(data.otherChargesDetail),
      notes: toStr(data.notes),
      validFrom: toStr(data.validFrom),
    });
    setShowIntake(false);
    setShowForm(true);
  };

  const skipIntake = () => {
    setDraft(emptyDraft);
    setShowIntake(false);
    setShowForm(true);
  };

  const handleSave = () => {
    if (editingId) {
      update(editingId, draft);
    } else {
      add({ ...draft, id: uid("exc") });
    }
    setShowForm(false);
    setEditingId(null);
  };

  const cancelAll = () => {
    setShowIntake(false);
    setShowForm(false);
    setEditingId(null);
  };

  if (!hydrated) {
    return (
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200 text-gray-500 text-sm">
        Cargando excepciones...
      </div>
    );
  }

  const showGateOutFields = draft.gateOut > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Excepciones por cliente/naviera</h2>
        <span className="text-xs text-gray-500">
          Reemplazan la tarifa estándar cuando hay match de cliente + naviera + tipo
        </span>
        <div className="flex-1" />
        <Button onClick={openNew}>Nueva excepción</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-md p-2 h-10 min-w-48"
        />
        <input
          type="text"
          list="exc-filter-customer"
          placeholder="Filtrar cliente..."
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="border border-gray-200 rounded-md p-2 h-10"
        />
        <datalist id="exc-filter-customer">
          {customerSuggestions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <input
          type="text"
          list="exc-filter-carrier"
          placeholder="Filtrar naviera..."
          value={carrierFilter}
          onChange={(e) => setCarrierFilter(e.target.value)}
          className="border border-gray-200 rounded-md p-2 h-10"
        />
        <datalist id="exc-filter-carrier">
          {carrierSuggestions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      {showIntake && (
        <div className="flex flex-col gap-2">
          <RateIntake
            type="local_exception"
            onExtracted={handleExtracted}
            onCancel={cancelAll}
          />
          <button
            type="button"
            onClick={skipIntake}
            className="text-sm text-blue-700 hover:underline self-start cursor-pointer"
          >
            Prefiero completar manualmente el formulario →
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <h3 className="font-semibold mb-3">
            {editingId ? "Editar excepción" : "Nueva excepción"}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Cliente
              <input
                type="text"
                list="exc-customer-sugg"
                value={draft.customer}
                onChange={(e) => setDraft({ ...draft, customer: e.target.value })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
              <datalist id="exc-customer-sugg">
                {customerSuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Naviera
              <input
                type="text"
                list="exc-carrier-sugg"
                value={draft.carrier}
                onChange={(e) => setDraft({ ...draft, carrier: e.target.value })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
              <datalist id="exc-carrier-sugg">
                {carrierSuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Tipo
              <select
                value={draft.tipo}
                onChange={(e) =>
                  setDraft({ ...draft, tipo: e.target.value as LocalExceptionTipo })
                }
                className="border border-gray-200 rounded-md p-2 h-10"
              >
                <option value="Dry">Dry</option>
                <option value="Reefer">Reefer</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Válido desde
              <input
                type="date"
                value={draft.validFrom}
                onChange={(e) => setDraft({ ...draft, validFrom: e.target.value })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              OTHC (USD/unidad)
              <input
                type="number"
                value={draft.othc}
                onChange={(e) => setDraft({ ...draft, othc: Number(e.target.value) })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Sello (USD/unidad)
              <input
                type="number"
                value={draft.sello}
                onChange={(e) =>
                  setDraft({ ...draft, sello: Number(e.target.value) })
                }
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              AMS (USD/BL)
              <input
                type="number"
                value={draft.ams}
                onChange={(e) => setDraft({ ...draft, ams: Number(e.target.value) })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              BL Fee (USD/BL)
              <input
                type="number"
                value={draft.blFee}
                onChange={(e) =>
                  setDraft({ ...draft, blFee: Number(e.target.value) })
                }
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Gate Out (USD/unidad)
              <input
                type="number"
                value={draft.gateOut}
                onChange={(e) =>
                  setDraft({ ...draft, gateOut: Number(e.target.value) })
                }
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>

            {showGateOutFields && (
              <>
                <label className="flex flex-col gap-1 text-sm col-span-2">
                  Puertos donde aplica Gate Out
                  <input
                    type="text"
                    value={draft.gateOutPorts}
                    onChange={(e) =>
                      setDraft({ ...draft, gateOutPorts: e.target.value })
                    }
                    placeholder="Shanghai, Busan, Ningbo"
                    className="border border-gray-200 rounded-md p-2 h-10"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm col-span-2">
                  Tipos de unidad donde aplica Gate Out
                  <input
                    type="text"
                    value={draft.gateOutUnitTypes}
                    onChange={(e) =>
                      setDraft({ ...draft, gateOutUnitTypes: e.target.value })
                    }
                    placeholder="20' GP, 40' GP"
                    className="border border-gray-200 rounded-md p-2 h-10"
                  />
                </label>
              </>
            )}

            <label className="flex flex-col gap-1 text-sm">
              Otros cargos (USD/unidad)
              <input
                type="number"
                value={draft.otherCharges}
                onChange={(e) =>
                  setDraft({ ...draft, otherCharges: Number(e.target.value) })
                }
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm col-span-2 md:col-span-3">
              Detalle otros cargos
              <input
                type="text"
                value={draft.otherChargesDetail}
                onChange={(e) =>
                  setDraft({ ...draft, otherChargesDetail: e.target.value })
                }
                placeholder="Security Surcharge 10/unit + TPO TPA 12/unit"
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm col-span-2 md:col-span-4">
              Notas
              <input
                type="text"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={cancelAll}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Guardar</Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {[
                "Cliente",
                "Naviera",
                "Tipo",
                "OTHC",
                "Sello",
                "AMS",
                "BL Fee",
                "Gate Out",
                "Puertos GO",
                "Tipos GO",
                "Otros",
                "Detalle otros",
                "Válido desde",
                "Notas",
                "Acciones",
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
            {filtered.map((r) => {
              const bg = CUSTOMER_COLORS[r.customer];
              const hasGateOut = r.gateOut > 0;
              return (
                <tr
                  key={r.id}
                  style={bg ? { backgroundColor: bg } : undefined}
                  className="text-sm"
                >
                  <td className="px-4 py-2 font-medium whitespace-nowrap">
                    {r.customer}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{r.carrier}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                        r.tipo === "Reefer"
                          ? "bg-blue-50 text-blue-800 border-blue-200"
                          : "bg-gray-50 text-gray-800 border-gray-200"
                      }`}
                    >
                      {r.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">${r.othc}</td>
                  <td className="px-4 py-2 whitespace-nowrap">${r.sello}</td>
                  <td className="px-4 py-2 whitespace-nowrap">${r.ams}</td>
                  <td className="px-4 py-2 whitespace-nowrap">${r.blFee}</td>
                  <td className="px-4 py-2 whitespace-nowrap font-medium">
                    ${r.gateOut}
                  </td>
                  <td className="px-4 py-2 max-w-xs">
                    {hasGateOut ? <Chips value={r.gateOutPorts} /> : "—"}
                  </td>
                  <td className="px-4 py-2 max-w-xs">
                    {hasGateOut ? <Chips value={r.gateOutUnitTypes} /> : "—"}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    ${r.otherCharges}
                  </td>
                  <td className="px-4 py-2 max-w-sm text-xs text-gray-700">
                    {r.otherChargesDetail || "—"}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-xs">
                    {r.validFrom || "-"}
                  </td>
                  <td className="px-4 py-2 max-w-xs truncate">{r.notes}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(r)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm("¿Eliminar excepción?")) remove(r.id);
                        }}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No hay excepciones
          </div>
        )}
      </div>
    </div>
  );
}
