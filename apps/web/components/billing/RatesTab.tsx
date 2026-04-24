"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useLocalStore } from "./useLocalStore";
import {
  AGENTS,
  AGENT_COLORS,
  Agent,
  CARRIERS,
  CONTAINER_TYPES,
  Carrier,
  ContainerType,
  RATES_STORAGE_KEY,
  Rate,
  SEED_RATES,
  getValidityStatus,
  uid,
} from "./constants";

const emptyDraft: Omit<Rate, "id"> = {
  agent: "IWS",
  carrier: "OOCL",
  route: "",
  tipo: "20'",
  sf: 0,
  blFee: 0,
  af: 0,
  afMax: 0,
  flexiArg: 0,
  validFrom: "",
  validTo: "",
  notes: "",
};

function ValidityBadge({ validTo }: { validTo: string }) {
  const status = getValidityStatus(validTo);
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-800 border-green-200",
    soon: "bg-yellow-100 text-yellow-800 border-yellow-200",
    expired: "bg-red-100 text-red-800 border-red-200",
  };
  const labels: Record<string, string> = {
    active: "Vigente",
    soon: "Vence <30d",
    expired: "Expirada",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export default function RatesTab() {
  const { items, add, update, remove, hydrated } = useLocalStore<Rate>(
    RATES_STORAGE_KEY,
    SEED_RATES
  );

  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState<Agent | "">("");
  const [carrierFilter, setCarrierFilter] = useState<Carrier | "">("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<Rate, "id">>(emptyDraft);
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((r) => {
      if (agentFilter && r.agent !== agentFilter) return false;
      if (carrierFilter && r.carrier !== carrierFilter) return false;
      if (!q) return true;
      return (
        r.agent.toLowerCase().includes(q) ||
        r.carrier.toLowerCase().includes(q) ||
        r.route.toLowerCase().includes(q) ||
        r.tipo.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
      );
    });
  }, [items, search, agentFilter, carrierFilter]);

  const openNew = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (rate: Rate) => {
    const { id: _id, ...rest } = rate;
    void _id;
    setDraft(rest);
    setEditingId(rate.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (editingId) {
      update(editingId, draft);
    } else {
      add({ ...draft, id: uid("rate") });
    }
    setShowForm(false);
    setEditingId(null);
  };

  if (!hydrated) {
    return <div className="text-gray-500 py-8 text-center">Cargando tarifas...</div>;
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
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value as Agent | "")}
          className="border border-gray-200 rounded-md p-2 h-10"
        >
          <option value="">Todos los agentes</option>
          {AGENTS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={carrierFilter}
          onChange={(e) => setCarrierFilter(e.target.value as Carrier | "")}
          className="border border-gray-200 rounded-md p-2 h-10"
        >
          <option value="">Todos los carriers</option>
          {CARRIERS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <Button onClick={openNew}>Nueva Tarifa</Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <h3 className="font-semibold mb-3">
            {editingId ? "Editar tarifa" : "Nueva tarifa"}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Agente
              <select
                value={draft.agent}
                onChange={(e) => setDraft({ ...draft, agent: e.target.value as Agent })}
                className="border border-gray-200 rounded-md p-2 h-10"
              >
                {AGENTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Carrier
              <select
                value={draft.carrier}
                onChange={(e) =>
                  setDraft({ ...draft, carrier: e.target.value as Carrier })
                }
                className="border border-gray-200 rounded-md p-2 h-10"
              >
                {CARRIERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Ruta
              <input
                type="text"
                value={draft.route}
                onChange={(e) => setDraft({ ...draft, route: e.target.value })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Tipo
              <select
                value={draft.tipo}
                onChange={(e) =>
                  setDraft({ ...draft, tipo: e.target.value as ContainerType })
                }
                className="border border-gray-200 rounded-md p-2 h-10"
              >
                {CONTAINER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              SF (USD/ctr)
              <input
                type="number"
                value={draft.sf}
                onChange={(e) => setDraft({ ...draft, sf: Number(e.target.value) })}
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
              AF (agency fee)
              <input
                type="number"
                value={draft.af}
                onChange={(e) => setDraft({ ...draft, af: Number(e.target.value) })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              AF Max
              <input
                type="number"
                value={draft.afMax}
                onChange={(e) => setDraft({ ...draft, afMax: Number(e.target.value) })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Flexi ARG
              <input
                type="number"
                value={draft.flexiArg}
                onChange={(e) =>
                  setDraft({ ...draft, flexiArg: Number(e.target.value) })
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
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
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
                "Agente",
                "Carrier",
                "Ruta",
                "Tipo",
                "SF",
                "BL Fee",
                "AF",
                "AF Max",
                "Flexi ARG",
                "Vigencia",
                "Estado",
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
            {filtered.map((r) => (
              <tr
                key={r.id}
                style={{ backgroundColor: AGENT_COLORS[r.agent] }}
                className="text-sm"
              >
                <td className="px-4 py-2 font-medium whitespace-nowrap">{r.agent}</td>
                <td className="px-4 py-2 whitespace-nowrap">{r.carrier}</td>
                <td className="px-4 py-2 whitespace-nowrap">{r.route}</td>
                <td className="px-4 py-2 whitespace-nowrap">{r.tipo}</td>
                <td className="px-4 py-2 whitespace-nowrap">${r.sf}</td>
                <td className="px-4 py-2 whitespace-nowrap">${r.blFee}</td>
                <td className="px-4 py-2 whitespace-nowrap">${r.af}</td>
                <td className="px-4 py-2 whitespace-nowrap">${r.afMax}</td>
                <td className="px-4 py-2 whitespace-nowrap">${r.flexiArg}</td>
                <td className="px-4 py-2 whitespace-nowrap text-xs">
                  {r.validFrom || "-"} / {r.validTo || "-"}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <ValidityBadge validTo={r.validTo} />
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
                        if (confirm("¿Eliminar tarifa?")) remove(r.id);
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
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500">No hay tarifas</div>
        )}
      </div>
    </div>
  );
}
