"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useLocalStore } from "./useLocalStore";
import RateIntake from "./RateIntake";
import {
  CARRIER_SUGGESTIONS,
  EBS_STORAGE_KEY,
  EBS_TRAFFIC_SUGGESTIONS,
  Ebs,
  SEED_EBS,
  ValidityStatus,
  carrierColor,
  carriersMatch,
  formatDateCl,
  getValidityStatus,
  uid,
  uniqueSuggestions,
} from "./constants";

const emptyDraft: Omit<Ebs, "id"> = {
  carrier: "",
  traffic: "",
  amountPerTEU: 0,
  validFrom: "",
  validTo: "",
  notes: "",
};

const STATUS_ORDER: Record<ValidityStatus, number> = {
  active: 0,
  soon: 1,
  expired: 2,
};

function VigenciaBadge({ validTo }: { validTo: string }) {
  const status = getValidityStatus(validTo);
  const styles: Record<ValidityStatus, string> = {
    active: "bg-green-100 text-green-800 border-green-300",
    soon: "bg-yellow-100 text-yellow-800 border-yellow-300",
    expired: "bg-red-100 text-red-800 border-red-300",
  };
  const labels: Record<ValidityStatus, string> = {
    active: "Vigente",
    soon: "Vence <30d",
    expired: "Expirada",
  };
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function trafficKey(t: string): string {
  return t.trim().toLowerCase();
}

// Identifies an existing EBS that "shares slot" with the candidate (same carrier
// + same traffic region). Used to detect duplicates and same-region-different-
// vigencia overlaps.
function findSameSlot(items: Ebs[], candidate: Pick<Ebs, "carrier" | "traffic">) {
  return items.find(
    (e) =>
      carriersMatch(e.carrier, candidate.carrier) &&
      trafficKey(e.traffic) === trafficKey(candidate.traffic)
  );
}

export default function EbsTab() {
  const { items, setItems, add, update, remove, hydrated } = useLocalStore<Ebs>(
    EBS_STORAGE_KEY,
    SEED_EBS
  );

  const [search, setSearch] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<Ebs, "id">>(emptyDraft);
  const [showIntake, setShowIntake] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const carrierSuggestions = useMemo(
    () => uniqueSuggestions(items.map((r) => r.carrier), CARRIER_SUGGESTIONS),
    [items]
  );
  const trafficSuggestions = useMemo(
    () => uniqueSuggestions(items.map((r) => r.traffic), EBS_TRAFFIC_SUGGESTIONS),
    [items]
  );

  const sortedFiltered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const cf = carrierFilter.toLowerCase().trim();
    const filtered = items.filter((r) => {
      if (cf && !r.carrier.toLowerCase().includes(cf)) return false;
      if (!q) return true;
      return (
        r.carrier.toLowerCase().includes(q) ||
        r.traffic.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
      );
    });
    return filtered.slice().sort((a, b) => {
      const sa = STATUS_ORDER[getValidityStatus(a.validTo)];
      const sb = STATUS_ORDER[getValidityStatus(b.validTo)];
      if (sa !== sb) return sa - sb;
      // Within same status: sooner validTo first for active/soon, later first for expired
      if (a.validTo && b.validTo) {
        return a.validTo.localeCompare(b.validTo);
      }
      return 0;
    });
  }, [items, search, carrierFilter]);

  const openNew = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setShowIntake(true);
    setShowForm(false);
  };

  const openEdit = (ebs: Ebs) => {
    const { id: _id, ...rest } = ebs;
    void _id;
    setDraft(rest);
    setEditingId(ebs.id);
    setShowIntake(false);
    setShowForm(true);
  };

  const handleExtracted = (data: Record<string, unknown>) => {
    setDraft({
      carrier: toStr(data.carrier),
      traffic: toStr(data.traffic),
      amountPerTEU: toNumber(data.amountPerTEU),
      validFrom: toStr(data.validFrom),
      validTo: toStr(data.validTo),
      notes: toStr(data.notes),
    });
    setShowIntake(false);
    setShowForm(true);
  };

  const handleExtractedMany = (rows: Record<string, unknown>[]) => {
    let added = 0;
    let updated = 0;
    let newPeriod = 0;
    // Compute the full next state in one pass and commit with a single setItems
    // call. Prior version called add() in a loop, which read stale `items` from
    // closure each time and silently dropped all but one row.
    setItems((prev) => {
      const next = prev.slice();
      for (const row of rows) {
        const candidate: Ebs = {
          id: uid("ebs"),
          carrier: toStr(row.carrier),
          traffic: toStr(row.traffic),
          amountPerTEU: toNumber(row.amountPerTEU),
          validFrom: toStr(row.validFrom),
          validTo: toStr(row.validTo),
          notes: toStr(row.notes),
        };
        if (!candidate.carrier || !candidate.traffic) {
          // skip rows without enough info to slot
          next.push(candidate);
          added++;
          continue;
        }
        const sameSlotIdx = next.findIndex(
          (e) =>
            carriersMatch(e.carrier, candidate.carrier) &&
            trafficKey(e.traffic) === trafficKey(candidate.traffic) &&
            e.validFrom === candidate.validFrom
        );
        if (sameSlotIdx >= 0) {
          // Same carrier+traffic+validFrom → real duplicate, refresh in place
          next[sameSlotIdx] = { ...candidate, id: next[sameSlotIdx]!.id };
          updated++;
          continue;
        }
        const differentVigencia = next.find(
          (e) =>
            carriersMatch(e.carrier, candidate.carrier) &&
            trafficKey(e.traffic) === trafficKey(candidate.traffic)
        );
        if (differentVigencia) newPeriod++;
        next.push(candidate);
        added++;
      }
      return next;
    });

    const parts = [`${added} guardado${added === 1 ? "" : "s"}`];
    if (updated > 0) parts.push(`${updated} actualizado${updated === 1 ? "" : "s"}`);
    if (newPeriod > 0)
      parts.push(`${newPeriod} nuevo${newPeriod === 1 ? "" : "s"} periodo${newPeriod === 1 ? "" : "s"}`);
    toast.success(parts.join(", "));

    setShowIntake(false);
    setShowForm(false);
    setEditingId(null);
  };

  const skipIntake = () => {
    setDraft(emptyDraft);
    setShowIntake(false);
    setShowForm(true);
  };

  const handleSave = () => {
    if (editingId) {
      update(editingId, draft);
      setShowForm(false);
      setEditingId(null);
      return;
    }

    const slot = findSameSlot(items, draft);
    if (slot) {
      if (slot.validFrom === draft.validFrom) {
        // Real duplicate — same carrier+traffic+validFrom
        const ok = confirm(
          `Ya existe un EBS de ${slot.carrier} para "${slot.traffic}" con la misma vigencia (${formatDateCl(slot.validFrom) || "sin fecha"}). ¿Querés actualizar el existente con estos valores?`
        );
        if (!ok) return; // user wants to keep editing — do not save
        update(slot.id, draft);
        toast.success("EBS existente actualizado");
        setShowForm(false);
        setEditingId(null);
        return;
      }
      // Same carrier+traffic, distinct validFrom → new period, save with notice
      toast(
        `Ya existe un EBS de ${slot.carrier} para "${slot.traffic}" vigente desde ${formatDateCl(slot.validFrom) || "sin fecha"}. Se creará un nuevo registro con la vigencia indicada.`,
        { duration: 6000, icon: "ℹ️" }
      );
    }

    add({ ...draft, id: uid("ebs") });
    setShowForm(false);
    setEditingId(null);
  };

  const cancelAll = () => {
    setShowIntake(false);
    setShowForm(false);
    setEditingId(null);
  };

  if (!hydrated) {
    return <div className="text-gray-500 py-8 text-center">Cargando EBS...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
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
          list="ebs-filter-carrier"
          placeholder="Filtrar naviera..."
          value={carrierFilter}
          onChange={(e) => setCarrierFilter(e.target.value)}
          className="border border-gray-200 rounded-md p-2 h-10"
        />
        <datalist id="ebs-filter-carrier">
          {carrierSuggestions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="flex-1" />
        <Button onClick={openNew}>Nuevo EBS</Button>
      </div>

      {showIntake && (
        <div className="flex flex-col gap-2">
          <RateIntake
            type="ebs"
            onExtracted={handleExtracted}
            onExtractedMany={handleExtractedMany}
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
            {editingId ? "Editar EBS" : "Nuevo EBS"}
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            El EBS aplica por <strong>región/tráfico</strong>, no por puerto específico. Por
            ejemplo &quot;Chile - Norte de Europa&quot; cubre Rotterdam, Hamburg, Antwerp, Grangemouth, etc.
            El valor se ingresa por TEU; el sistema calcula 20&apos;/Flexi = 1 TEU y 40&apos; = 2 TEU automáticamente.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Naviera
              <input
                type="text"
                list="ebs-carrier-sugg"
                value={draft.carrier}
                onChange={(e) => setDraft({ ...draft, carrier: e.target.value })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
              <datalist id="ebs-carrier-sugg">
                {carrierSuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Tráfico
              <input
                type="text"
                list="ebs-traffic-sugg"
                value={draft.traffic}
                onChange={(e) => setDraft({ ...draft, traffic: e.target.value })}
                placeholder="Chile - Norte de Europa / ..."
                className="border border-gray-200 rounded-md p-2 h-10"
              />
              <datalist id="ebs-traffic-sugg">
                {trafficSuggestions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              USD por TEU
              <input
                type="number"
                value={draft.amountPerTEU}
                onChange={(e) =>
                  setDraft({ ...draft, amountPerTEU: Number(e.target.value) })
                }
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Vigente desde
              <input
                type="date"
                value={draft.validFrom}
                onChange={(e) => setDraft({ ...draft, validFrom: e.target.value })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Vigente hasta
              <input
                type="date"
                value={draft.validTo}
                onChange={(e) => setDraft({ ...draft, validTo: e.target.value })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm col-span-2 md:col-span-3">
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
                "Naviera",
                "Tráfico",
                "USD/TEU",
                "20' equiv.",
                "40' equiv.",
                "Válido desde",
                "Válido hasta",
                "Vigencia",
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
            {sortedFiltered.map((r) => (
              <tr
                key={r.id}
                className="text-sm"
                style={{ backgroundColor: carrierColor(r.carrier) }}
              >
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  {r.carrier}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{r.traffic}</td>
                <td className="px-4 py-3 whitespace-nowrap font-medium">
                  ${r.amountPerTEU}/TEU
                </td>
                <td className="px-4 py-3 whitespace-nowrap">${r.amountPerTEU}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  ${r.amountPerTEU * 2}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                  {formatDateCl(r.validFrom)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                  {formatDateCl(r.validTo)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <VigenciaBadge validTo={r.validTo} />
                </td>
                <td className="px-4 py-3 max-w-xs truncate text-gray-600">
                  {r.notes}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("¿Eliminar EBS?")) remove(r.id);
                      }}
                    >
                      Eliminar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sortedFiltered.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No hay registros EBS
          </div>
        )}
      </div>
    </div>
  );
}
