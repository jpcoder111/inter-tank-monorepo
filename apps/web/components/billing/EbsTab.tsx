"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useLocalStore } from "./useLocalStore";
import RateIntake from "./RateIntake";
import {
  CARRIER_SUGGESTIONS,
  CONTAINER_TYPE_SUGGESTIONS,
  EBS_STORAGE_KEY,
  Ebs,
  SEED_EBS,
  uid,
  uniqueSuggestions,
} from "./constants";

const emptyDraft: Omit<Ebs, "id"> = {
  carrier: "",
  traffic: "",
  tipo: "",
  amountPerTEU: 0,
  validFrom: "",
  validTo: "",
  notes: "",
};

function teuFor(tipo: string): number {
  return tipo.startsWith("40") ? 2 : 1;
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

export default function EbsTab() {
  const { items, add, update, remove, hydrated } = useLocalStore<Ebs>(
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
    () => uniqueSuggestions(items.map((r) => r.traffic)),
    [items]
  );
  const tipoSuggestions = useMemo(
    () => uniqueSuggestions(items.map((r) => r.tipo), CONTAINER_TYPE_SUGGESTIONS),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const cf = carrierFilter.toLowerCase().trim();
    return items.filter((r) => {
      if (cf && !r.carrier.toLowerCase().includes(cf)) return false;
      if (!q) return true;
      return (
        r.carrier.toLowerCase().includes(q) ||
        r.traffic.toLowerCase().includes(q) ||
        r.tipo.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
      );
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
      tipo: toStr(data.tipo),
      amountPerTEU: toNumber(data.amountPerTEU),
      validFrom: toStr(data.validFrom),
      validTo: toStr(data.validTo),
      notes: toStr(data.notes),
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
      add({ ...draft, id: uid("ebs") });
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
          placeholder="Filtrar carrier..."
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Carrier
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
                placeholder="Chile-N.Europa / Chile-Grangemouth / ..."
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
              <input
                type="text"
                list="ebs-tipo-sugg"
                value={draft.tipo}
                onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
              <datalist id="ebs-tipo-sugg">
                {tipoSuggestions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Monto por TEU (USD)
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
            <label className="flex flex-col gap-1 text-sm col-span-2">
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
                "Carrier",
                "Tráfico",
                "Tipo",
                "USD/TEU",
                "Equiv. 20'",
                "Equiv. 40'",
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
            {filtered.map((r) => {
              const per20 = r.amountPerTEU * 1;
              const per40 = r.amountPerTEU * 2;
              const currentTeu = teuFor(r.tipo);
              return (
                <tr key={r.id} className="text-sm">
                  <td className="px-4 py-2 font-medium whitespace-nowrap">
                    {r.carrier}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{r.traffic}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {r.tipo}{" "}
                    <span className="text-xs text-gray-500">
                      ({currentTeu} TEU)
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">${r.amountPerTEU}</td>
                  <td className="px-4 py-2 whitespace-nowrap">${per20}</td>
                  <td className="px-4 py-2 whitespace-nowrap">${per40}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-xs">
                    {r.validFrom || "-"} / {r.validTo || "-"}
                  </td>
                  <td className="px-4 py-2 max-w-xs truncate">{r.notes}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
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
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500">No hay registros EBS</div>
        )}
      </div>
    </div>
  );
}
