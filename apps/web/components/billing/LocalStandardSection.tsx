"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useLocalStore } from "./useLocalStore";
import RateIntake from "./RateIntake";
import {
  LOCAL_GATE_OUT_CONDITIONS_DEFAULT,
  LOCAL_STD_STORAGE_KEY,
  LocalStandardRate,
  SEED_LOCAL_STANDARDS,
  formatDateCl,
  uid,
} from "./constants";

const emptyDraft: Omit<LocalStandardRate, "id"> = {
  name: "",
  othcDry: 0,
  othcReefer: 0,
  sello: 0,
  ams: 0,
  blFee: 0,
  gateOutDry: 0,
  gateOutReefer: 0,
  gateOutConditions: LOCAL_GATE_OUT_CONDITIONS_DEFAULT,
  validFrom: "",
  notes: "",
};

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

export default function LocalStandardSection() {
  const { items, add, remove, hydrated } = useLocalStore<LocalStandardRate>(
    LOCAL_STD_STORAGE_KEY,
    SEED_LOCAL_STANDARDS
  );

  const [showHistory, setShowHistory] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Omit<LocalStandardRate, "id">>(emptyDraft);

  const current = useMemo(() => {
    const byName = new Map<string, LocalStandardRate>();
    for (const item of items) {
      const existing = byName.get(item.name);
      if (!existing || item.validFrom > existing.validFrom) {
        byName.set(item.name, item);
      }
    }
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const history = useMemo(
    () =>
      items
        .slice()
        .sort(
          (a, b) =>
            a.name.localeCompare(b.name) || b.validFrom.localeCompare(a.validFrom)
        ),
    [items]
  );

  const openNew = () => {
    setDraft({ ...emptyDraft, validFrom: todayIso() });
    setShowIntake(true);
    setShowForm(false);
  };

  const openUpdate = (rate: LocalStandardRate) => {
    const { id: _id, ...rest } = rate;
    void _id;
    setDraft({ ...rest, validFrom: todayIso() });
    setShowIntake(true);
    setShowForm(false);
  };

  const skipIntake = () => {
    setShowIntake(false);
    setShowForm(true);
  };

  const cancelAll = () => {
    setShowIntake(false);
    setShowForm(false);
  };

  const handleExtracted = (data: Record<string, unknown>) => {
    setDraft({
      name: toStr(data.name) || draft.name,
      othcDry: toNumber(data.othcDry) || draft.othcDry,
      othcReefer: toNumber(data.othcReefer) || draft.othcReefer,
      sello: toNumber(data.sello) || draft.sello,
      ams: toNumber(data.ams) || draft.ams,
      blFee: toNumber(data.blFee) || draft.blFee,
      gateOutDry: toNumber(data.gateOutDry) || draft.gateOutDry,
      gateOutReefer: toNumber(data.gateOutReefer) || draft.gateOutReefer,
      gateOutConditions:
        toStr(data.gateOutConditions) || draft.gateOutConditions,
      validFrom: toStr(data.validFrom) || draft.validFrom || todayIso(),
      notes: toStr(data.notes) || draft.notes,
    });
    setShowIntake(false);
    setShowForm(true);
  };

  const handleSave = () => {
    add({ ...draft, id: uid("local-std") });
    setShowForm(false);
  };

  if (!hydrated) {
    return (
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200 text-gray-500 text-sm">
        Cargando tarifa estándar...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Tarifa Estándar</h2>
        <span className="text-xs text-gray-500">
          Aplica cuando no hay excepción para el cliente/naviera
        </span>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowHistory((h) => !h)}
        >
          {showHistory ? "Ocultar historial" : "Ver historial"}
        </Button>
        <Button size="sm" onClick={openNew}>
          Nueva tarifa estándar
        </Button>
      </div>

      {showIntake && (
        <div className="flex flex-col gap-2">
          <RateIntake
            type="local_std"
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
            {draft.name
              ? `Nueva versión de "${draft.name}"`
              : "Nueva tarifa estándar"}
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Guardar crea un nuevo registro con la fecha de inicio indicada. El registro
            anterior con el mismo nombre queda en el historial.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Nombre
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Estándar / San Clemente"
                className="border border-gray-200 rounded-md p-2 h-10"
              />
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
              OTHC Dry (USD/unidad)
              <input
                type="number"
                value={draft.othcDry}
                onChange={(e) =>
                  setDraft({ ...draft, othcDry: Number(e.target.value) })
                }
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              OTHC Reefer (USD/unidad)
              <input
                type="number"
                value={draft.othcReefer}
                onChange={(e) =>
                  setDraft({ ...draft, othcReefer: Number(e.target.value) })
                }
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Sello (USD/unidad)
              <input
                type="number"
                value={draft.sello}
                onChange={(e) => setDraft({ ...draft, sello: Number(e.target.value) })}
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
                onChange={(e) => setDraft({ ...draft, blFee: Number(e.target.value) })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Gate Out Dry (USD/unidad)
              <input
                type="number"
                value={draft.gateOutDry}
                onChange={(e) =>
                  setDraft({ ...draft, gateOutDry: Number(e.target.value) })
                }
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Gate Out Reefer (USD/unidad)
              <input
                type="number"
                value={draft.gateOutReefer}
                onChange={(e) =>
                  setDraft({ ...draft, gateOutReefer: Number(e.target.value) })
                }
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm col-span-2 md:col-span-4">
              Condiciones Gate Out
              <input
                type="text"
                value={draft.gateOutConditions}
                onChange={(e) =>
                  setDraft({ ...draft, gateOutConditions: e.target.value })
                }
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
            <Button onClick={handleSave}>Guardar como nueva versión</Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {[
                "Nombre",
                "OTHC Dry",
                "OTHC Reefer",
                "Sello",
                "AMS",
                "BL Fee",
                "Gate Out Dry",
                "Gate Out Reefer",
                "Condiciones Gate Out",
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
            {current.map((r) => (
              <tr key={r.id} className="text-sm">
                <td className="px-4 py-2 font-medium whitespace-nowrap">{r.name}</td>
                <td className="px-4 py-2 whitespace-nowrap">${r.othcDry}</td>
                <td className="px-4 py-2 whitespace-nowrap">${r.othcReefer}</td>
                <td className="px-4 py-2 whitespace-nowrap">${r.sello}</td>
                <td className="px-4 py-2 whitespace-nowrap">${r.ams}</td>
                <td className="px-4 py-2 whitespace-nowrap">${r.blFee}</td>
                <td className="px-4 py-2 whitespace-nowrap">${r.gateOutDry}</td>
                <td className="px-4 py-2 whitespace-nowrap">${r.gateOutReefer}</td>
                <td className="px-4 py-2 max-w-xs text-xs text-gray-700">
                  {r.gateOutConditions || "—"}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{formatDateCl(r.validFrom)}</td>
                <td className="px-4 py-2 max-w-xs truncate">{r.notes}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <Button variant="outline" size="sm" onClick={() => openUpdate(r)}>
                    Actualizar precios
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {current.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No hay tarifas estándar configuradas
          </div>
        )}
      </div>

      {showHistory && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <div className="px-4 py-2 border-b border-gray-200 text-sm font-medium text-gray-700 bg-gray-50">
            Historial (todas las versiones)
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Nombre",
                  "OTHC Dry",
                  "OTHC Reefer",
                  "Sello",
                  "AMS",
                  "BL Fee",
                  "Gate Out Dry",
                  "Gate Out Reefer",
                  "Válido desde",
                  "Estado",
                  "Notas",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {history.map((r) => {
                const isCurrent = current.some((c) => c.id === r.id);
                return (
                  <tr
                    key={r.id}
                    className={`text-sm ${
                      isCurrent ? "bg-green-50" : "text-gray-500"
                    }`}
                  >
                    <td className="px-4 py-2 font-medium whitespace-nowrap">
                      {r.name}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">${r.othcDry}</td>
                    <td className="px-4 py-2 whitespace-nowrap">${r.othcReefer}</td>
                    <td className="px-4 py-2 whitespace-nowrap">${r.sello}</td>
                    <td className="px-4 py-2 whitespace-nowrap">${r.ams}</td>
                    <td className="px-4 py-2 whitespace-nowrap">${r.blFee}</td>
                    <td className="px-4 py-2 whitespace-nowrap">${r.gateOutDry}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      ${r.gateOutReefer}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {formatDateCl(r.validFrom)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {isCurrent ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                          Vigente
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300">
                          Reemplazada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 max-w-xs truncate">{r.notes}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {!isCurrent && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm("¿Eliminar versión del historial?")) remove(r.id);
                          }}
                        >
                          Eliminar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {history.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">
              Sin historial
            </div>
          )}
        </div>
      )}
    </div>
  );
}
