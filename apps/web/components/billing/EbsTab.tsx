"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useLocalStore } from "./useLocalStore";
import { useBulkSelection } from "./useBulkSelection";
import BulkActionsBar from "./BulkActionsBar";
import RateIntake from "./RateIntake";
import {
  CARRIER_SUGGESTIONS,
  EBS_STORAGE_KEY,
  EBS_TRAFFIC_SUGGESTIONS,
  Ebs,
  EbsRowMeta,
  EbsRowStatus,
  EbsTipo,
  SEED_EBS,
  carrierColor,
  carriersMatch,
  computeEbsRowMeta,
  formatDateCl,
  normalizeEbs,
  uid,
  uniqueSuggestions,
} from "./constants";

const emptyDraft: Omit<Ebs, "id"> = {
  carrier: "",
  traffic: "",
  tipo: "Dry",
  amountPerTEU: 0,
  validFrom: "",
  validTo: "",
  notes: "",
};

const STATUS_ORDER: Record<EbsRowStatus, number> = {
  vigente: 0,
  soon: 1,
  reemplazado: 2,
};

function VigenciaBadge({ meta }: { meta: EbsRowMeta | undefined }) {
  const status = meta?.status ?? "vigente";
  if (status === "soon") {
    return (
      <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold border bg-yellow-100 text-yellow-800 border-yellow-300">
        Vence &lt;30d
      </span>
    );
  }
  if (status === "reemplazado") {
    return (
      <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold border bg-gray-100 text-gray-700 border-gray-300">
        Reemplazado
      </span>
    );
  }
  return (
    <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold border bg-green-100 text-green-800 border-green-300">
      Vigente
    </span>
  );
}

function TipoBadge({ tipo }: { tipo: EbsTipo }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
        tipo === "Reefer"
          ? "bg-blue-50 text-blue-800 border-blue-200"
          : "bg-gray-50 text-gray-800 border-gray-200"
      }`}
    >
      {tipo}
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

// A "slot" is now carrier + traffic + tipo. Reefer and Dry never collide,
// so a Dry vigente and a Reefer vigente coexist for the same carrier+traffic.
function sameSlot(
  a: Pick<Ebs, "carrier" | "traffic" | "tipo">,
  b: Pick<Ebs, "carrier" | "traffic" | "tipo">
): boolean {
  return (
    carriersMatch(a.carrier, b.carrier) &&
    trafficKey(a.traffic) === trafficKey(b.traffic) &&
    (a.tipo ?? "Dry") === (b.tipo ?? "Dry")
  );
}

function findSameSlot(items: Ebs[], candidate: Pick<Ebs, "carrier" | "traffic" | "tipo">) {
  return items.find((e) => sameSlot(e, candidate));
}

export default function EbsTab() {
  const {
    items: rawItems,
    setItems,
    add,
    update,
    remove,
    removeMany,
    hydrated,
  } = useLocalStore<Ebs>(EBS_STORAGE_KEY, SEED_EBS);

  // Coerce legacy records (added before `tipo` existed) so all downstream
  // code can rely on tipo being present.
  const items = useMemo(() => rawItems.map(normalizeEbs), [rawItems]);

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

  // Vigente/reemplazado + overlap is derived from the *full* item set (not the
  // filtered view) so a search that hides the newer record doesn't make an
  // older one look vigente.
  const rowMeta = useMemo(() => computeEbsRowMeta(items), [items]);

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
      // Carrier alphabetical, then traffic, then Dry before Reefer, then
      // vigente before soon before reemplazado, then most recent validFrom.
      const carrierCmp = a.carrier.localeCompare(b.carrier);
      if (carrierCmp !== 0) return carrierCmp;
      const trafficCmp = a.traffic.localeCompare(b.traffic);
      if (trafficCmp !== 0) return trafficCmp;
      const tipoCmp = a.tipo.localeCompare(b.tipo);
      if (tipoCmp !== 0) return tipoCmp;
      const sa = STATUS_ORDER[rowMeta.get(a.id)?.status ?? "vigente"];
      const sb = STATUS_ORDER[rowMeta.get(b.id)?.status ?? "vigente"];
      if (sa !== sb) return sa - sb;
      return b.validFrom.localeCompare(a.validFrom);
    });
  }, [items, search, carrierFilter, rowMeta]);

  const visibleIds = useMemo(
    () => sortedFiltered.map((r) => r.id),
    [sortedFiltered]
  );
  const { selected, toggleOne, toggleAllVisible, clear, allVisibleSelected } =
    useBulkSelection(visibleIds);

  const handleBulkDelete = () => {
    const ids = Array.from(selected);
    removeMany(ids);
    clear();
    toast.success(`${ids.length} EBS eliminado${ids.length === 1 ? "" : "s"}`);
  };

  const openNew = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setShowIntake(true);
    setShowForm(false);
  };

  const openEdit = (ebs: Ebs) => {
    const { id: _id, ...rest } = ebs;
    void _id;
    setDraft({ ...rest, tipo: rest.tipo ?? "Dry" });
    setEditingId(ebs.id);
    setShowIntake(false);
    setShowForm(true);
  };

  const handleExtracted = (data: Record<string, unknown>) => {
    const tipoRaw = toStr(data.tipo).trim().toLowerCase();
    const tipo: EbsTipo = tipoRaw === "reefer" ? "Reefer" : "Dry";
    setDraft({
      carrier: toStr(data.carrier),
      traffic: toStr(data.traffic),
      tipo,
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
        const tipoRaw = toStr(row.tipo).trim().toLowerCase();
        const candidate: Ebs = {
          id: uid("ebs"),
          carrier: toStr(row.carrier),
          traffic: toStr(row.traffic),
          tipo: tipoRaw === "reefer" ? "Reefer" : "Dry",
          amountPerTEU: toNumber(row.amountPerTEU),
          validFrom: toStr(row.validFrom),
          validTo: toStr(row.validTo),
          notes: toStr(row.notes),
        };
        if (!candidate.carrier || !candidate.traffic) {
          next.push(candidate);
          added++;
          continue;
        }
        const sameSlotIdx = next.findIndex(
          (e) => sameSlot(e, candidate) && e.validFrom === candidate.validFrom
        );
        if (sameSlotIdx >= 0) {
          // Same slot AND same validFrom → duplicate, refresh in place
          next[sameSlotIdx] = { ...candidate, id: next[sameSlotIdx]!.id };
          updated++;
          continue;
        }
        const differentVigencia = next.find((e) => sameSlot(e, candidate));
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
        const ok = confirm(
          `Ya existe un EBS ${slot.tipo} de ${slot.carrier} para "${slot.traffic}" con la misma vigencia (${formatDateCl(slot.validFrom) || "sin fecha"}). ¿Querés actualizar el existente con estos valores?`
        );
        if (!ok) return;
        update(slot.id, draft);
        toast.success("EBS existente actualizado");
        setShowForm(false);
        setEditingId(null);
        return;
      }
      toast(
        `Ya existe un EBS ${slot.tipo} de ${slot.carrier} para "${slot.traffic}" vigente desde ${formatDateCl(slot.validFrom) || "sin fecha"}. Se creará un nuevo registro con la vigencia indicada.`,
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
              Tipo
              <select
                value={draft.tipo}
                onChange={(e) =>
                  setDraft({ ...draft, tipo: e.target.value as EbsTipo })
                }
                className="border border-gray-200 rounded-md p-2 h-10 bg-white"
              >
                <option value="Dry">Dry</option>
                <option value="Reefer">Reefer</option>
              </select>
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

      <BulkActionsBar
        count={selected.size}
        onDelete={handleBulkDelete}
        onClear={clear}
        itemLabel="EBS"
      />

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="Seleccionar todos"
                />
              </th>
              {[
                "Naviera",
                "Tráfico",
                "Tipo",
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
            {sortedFiltered.map((r) => {
              const meta = rowMeta.get(r.id);
              const isReefer = r.tipo === "Reefer";
              return (
              <tr
                key={r.id}
                className="text-sm"
                style={{ backgroundColor: carrierColor(r.carrier) }}
              >
                <td className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleOne(r.id)}
                    aria-label={`Seleccionar ${r.carrier} ${r.traffic} ${r.tipo}`}
                  />
                </td>
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {meta?.hasOverlap && (
                      <span
                        title="Esta vigencia se solapa con otra del mismo tráfico — revisar"
                        className="text-yellow-700"
                      >
                        ⚠️
                      </span>
                    )}
                    {r.carrier}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{r.traffic}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <TipoBadge tipo={r.tipo} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap font-medium">
                  ${r.amountPerTEU}/TEU
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {isReefer ? (
                    <span
                      className="text-gray-400"
                      title="Reefer 20' no existe en Chile"
                    >
                      —
                    </span>
                  ) : (
                    `$${r.amountPerTEU}`
                  )}
                </td>
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
                  <VigenciaBadge meta={meta} />
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
              );
            })}
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
