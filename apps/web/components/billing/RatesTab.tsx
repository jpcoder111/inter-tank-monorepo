"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useLocalStore } from "./useLocalStore";
import { useBulkSelection } from "./useBulkSelection";
import BulkActionsBar from "./BulkActionsBar";
import NewRateFlow from "./NewRateFlow";
import {
  AGENT_SUGGESTIONS,
  CARRIER_SUGGESTIONS,
  RATES_STORAGE_KEY,
  Rate,
  SEED_RATES,
  ValidityStatus,
  agentColor,
  carrierColor,
  formatDateCl,
  getValidityStatus,
  normalizeRate,
  uniqueSuggestions,
} from "./constants";

// True if a rate carries any kind values worth surfacing in the listing.
// v3 rates store this in `kind_values`; legacy rows still use the fixed
// thermal/haulage/discount fields, which migrateRateV3 will eventually fold
// into kind_values but the fallback keeps pre-migration data visible.
function hasAdditionalCosts(r: Rate): boolean {
  if (r.kind_values && r.kind_values.length > 0) {
    return r.kind_values.some(
      (kv) =>
        (kv.value20 ?? 0) !== 0 ||
        (kv.value40 ?? 0) !== 0 ||
        (kv.value_unique ?? 0) !== 0
    );
  }
  return (
    (r.thermalLinerChile20 ?? 0) > 0 ||
    (r.thermalLinerChile40 ?? 0) > 0 ||
    (r.thermalLinerMendoza20 ?? 0) > 0 ||
    (r.thermalLinerMendoza40 ?? 0) > 0 ||
    (r.fcaHaulageMendoza20 ?? 0) > 0 ||
    (r.fcaHaulageMendoza40 ?? 0) > 0 ||
    (r.discountInsulated ?? 0) > 0 ||
    (r.additionalNotes ?? "").trim() !== ""
  );
}

// Compact one-line summary of a rate's kinds for the listing's "Kinds" column.
// Format examples:
//   "Insulado Chile=200/300 · Agency Fee=75"
//   "Precarriage Mendoza=2170/2270"
// Returns "—" when the rate has no v3 kinds.
function formatRateKinds(r: Rate): string {
  if (!r.kind_values || r.kind_values.length === 0) return "—";
  const defs = r.kinds ?? [];
  const parts: string[] = [];
  for (const kv of r.kind_values) {
    const def = defs.find((k) => k.id === kv.kind_id);
    const label = def?.label ?? kv.kind_id;
    if (def?.by_size) {
      const v20 = kv.value20 ?? "—";
      const v40 = kv.value40 ?? "—";
      parts.push(`${label}=${v20}/${v40}`);
    } else {
      parts.push(`${label}=${kv.value_unique ?? "—"}`);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

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

function topByFrequency(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const v = (raw ?? "").trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([v]) => v);
}

type AgentSummary = {
  agent: string;
  rates: Rate[];
  topCarriers: string[];
  topRoutes: string[];
  active: number;
  soon: number;
  expired: number;
};

function summarizeAgent(agent: string, rates: Rate[]): AgentSummary {
  const counts: Record<ValidityStatus, number> = { active: 0, soon: 0, expired: 0 };
  for (const r of rates) counts[getValidityStatus(r.validTo)]++;
  return {
    agent,
    rates,
    topCarriers: topByFrequency(rates.map((r) => r.carrier), 3),
    topRoutes: topByFrequency(rates.map((r) => r.route), 3),
    active: counts.active,
    soon: counts.soon,
    expired: counts.expired,
  };
}

export default function RatesTab() {
  const {
    items: rawItems,
    setItems,
    update,
    remove,
    removeMany,
    hydrated,
  } = useLocalStore<Rate>(RATES_STORAGE_KEY, SEED_RATES);

  // Migrate legacy single-thermal/haulage records to the new
  // Chile/Mendoza-split fields on every read so downstream code can rely on
  // the new keys without repeating the fallback logic everywhere.
  const items = useMemo(() => rawItems.map(normalizeRate), [rawItems]);

  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Mode: list (default) | create (NewRateFlow open) | edit (NewRateFlow with
  // a single rate prefilled). Replaces the previous showIntake/showForm/draft
  // duality.
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingRate, setEditingRate] = useState<Rate | null>(null);

  const agentSuggestions = useMemo(
    () => uniqueSuggestions(items.map((r) => r.agent), AGENT_SUGGESTIONS),
    [items]
  );
  const carrierSuggestions = useMemo(
    () => uniqueSuggestions(items.map((r) => r.carrier), CARRIER_SUGGESTIONS),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const af = agentFilter.toLowerCase().trim();
    const cf = carrierFilter.toLowerCase().trim();
    return items.filter((r) => {
      if (af && !r.agent.toLowerCase().includes(af)) return false;
      if (cf && !r.carrier.toLowerCase().includes(cf)) return false;
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

  const groups = useMemo<AgentSummary[]>(() => {
    // Key by lowercase-trimmed agent so case variants ("Balguerie" /
    // "BALGUERIE" / "balguerie") collapse into one card. Display name uses
    // the casing of the first row encountered for the slot.
    const map = new Map<string, { display: string; rates: Rate[] }>();
    for (const r of filtered) {
      const trimmed = r.agent.trim();
      const key = trimmed ? trimmed.toLowerCase() : "(sin agente)";
      let slot = map.get(key);
      if (!slot) {
        slot = { display: trimmed || "(Sin agente)", rates: [] };
        map.set(key, slot);
      }
      slot.rates.push(r);
    }
    return Array.from(map.values())
      .map(({ display, rates }) => summarizeAgent(display, rates))
      .sort((a, b) => a.agent.localeCompare(b.agent));
  }, [filtered]);

  const allExpanded = groups.length > 0 && groups.every((g) => expanded.has(g.agent));

  const visibleIds = useMemo(() => filtered.map((r) => r.id), [filtered]);
  const {
    selected,
    toggleOne,
    toggleMany,
    toggleAllVisible,
    clear,
    allVisibleSelected,
  } = useBulkSelection(visibleIds);

  const handleBulkDelete = () => {
    const ids = Array.from(selected);
    removeMany(ids);
    clear();
    toast.success(`${ids.length} tarifa${ids.length === 1 ? "" : "s"} eliminada${ids.length === 1 ? "" : "s"}`);
  };

  // Builds the BulkActionsBar message: "X tarifas de [agente]" when the
  // selection lives in a single agent, "X tarifas de Y agentes" when spread.
  const bulkMessage = useMemo(() => {
    if (selected.size === 0) return undefined;
    const idToAgent = new Map(items.map((r) => [r.id, r.agent.trim() || "(sin agente)"]));
    const agents = new Set<string>();
    for (const id of selected) {
      const a = idToAgent.get(id);
      if (a) agents.add(a);
    }
    const n = selected.size;
    const plural = n === 1 ? "tarifa" : "tarifas";
    const ending = n === 1 ? "" : "s";
    if (agents.size === 1) {
      const a = agents.values().next().value;
      return `${n} ${plural} de ${a} seleccionada${ending}`;
    }
    return `${n} ${plural} de ${agents.size} agentes seleccionada${ending}`;
  }, [selected, items]);

  const toggleAgent = (agent: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(agent)) next.delete(agent);
      else next.add(agent);
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(groups.map((g) => g.agent)));
    }
  };

  const openNew = () => {
    setEditingRate(null);
    setMode("create");
  };

  const openEdit = (rate: Rate) => {
    setEditingRate(rate);
    setMode("edit");
  };

  // Bulk save from NewRateFlow's preview. The component already
  // pre-generated IDs and applied common defaults (agent, validity, costs),
  // so all we do here is push.
  const handleSaveMany = (newRates: Rate[]) => {
    setItems((prev) => [...prev, ...newRates]);
    toast.success(
      `${newRates.length} tarifa${newRates.length === 1 ? "" : "s"} guardada${newRates.length === 1 ? "" : "s"}`
    );
    setMode("list");
    setEditingRate(null);
  };

  // Single-row save when editing an existing rate via NewRateFlow's edit mode.
  const handleSaveEdit = (updated: Rate) => {
    update(updated.id, updated);
    toast.success("Tarifa actualizada");
    setMode("list");
    setEditingRate(null);
  };

  const cancelMode = () => {
    setMode("list");
    setEditingRate(null);
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
        <input
          type="text"
          list="rates-filter-agent"
          placeholder="Filtrar agente..."
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="border border-gray-200 rounded-md p-2 h-10"
        />
        <datalist id="rates-filter-agent">
          {agentSuggestions.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <input
          type="text"
          list="rates-filter-carrier"
          placeholder="Filtrar carrier..."
          value={carrierFilter}
          onChange={(e) => setCarrierFilter(e.target.value)}
          className="border border-gray-200 rounded-md p-2 h-10"
        />
        <datalist id="rates-filter-carrier">
          {carrierSuggestions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="flex-1" />
        <Button
          variant="outline"
          onClick={toggleAllVisible}
          disabled={visibleIds.length === 0}
        >
          {allVisibleSelected ? "Desmarcar todas" : "Seleccionar todas"}
        </Button>
        <Button variant="outline" onClick={toggleAll} disabled={groups.length === 0}>
          {allExpanded ? "Colapsar todos" : "Expandir todos"}
        </Button>
        <Button onClick={openNew}>Nueva Tarifa</Button>
      </div>

      <BulkActionsBar
        count={selected.size}
        onDelete={handleBulkDelete}
        onClear={clear}
        itemLabel="tarifa"
        message={bulkMessage}
      />

      {mode !== "list" && (
        <NewRateFlow
          existingRates={items}
          onSaveMany={handleSaveMany}
          onSaveEdit={handleSaveEdit}
          editingRate={mode === "edit" ? editingRate : null}
          onCancel={cancelMode}
        />
      )}

      {groups.length === 0 ? (
        <div className="bg-white rounded-lg shadow text-center py-8 text-gray-500">
          No hay tarifas
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => {
            const isOpen = expanded.has(g.agent);
            const bg = agentColor(g.agent);
            const groupRateIds = g.rates.map((r) => r.id);
            const groupAllSelected =
              groupRateIds.length > 0 &&
              groupRateIds.every((id) => selected.has(id));
            const groupSomeSelected =
              !groupAllSelected &&
              groupRateIds.some((id) => selected.has(id));
            return (
              <div
                key={g.agent}
                className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
              >
                <div
                  className="flex items-center"
                  style={{ backgroundColor: bg }}
                >
                  <label
                    className="px-3 self-stretch flex items-center cursor-pointer hover:brightness-95"
                    title={`Seleccionar todas las tarifas de ${g.agent}`}
                  >
                    <input
                      type="checkbox"
                      checked={groupAllSelected}
                      // Visually hint partial selection — most browsers honor
                      // `indeterminate` only via DOM property, but the parent
                      // styling makes intent clear enough without it.
                      ref={(el) => {
                        if (el) el.indeterminate = groupSomeSelected;
                      }}
                      onChange={() => toggleMany(groupRateIds)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </label>
                <button
                  type="button"
                  onClick={() => toggleAgent(g.agent)}
                  className="flex-1 flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-left cursor-pointer hover:brightness-95 transition"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-700 font-mono text-xs w-4 text-center">
                      {isOpen ? "▼" : "▶"}
                    </span>
                    <span className="font-semibold text-base">{g.agent}</span>
                    <span className="text-sm text-gray-700">
                      ({g.rates.length} {g.rates.length === 1 ? "tarifa" : "tarifas"})
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-700 flex-1 min-w-0">
                    {g.topCarriers.length > 0 && (
                      <span>
                        <span className="text-gray-500">Carriers:</span>{" "}
                        <span className="font-medium">{g.topCarriers.join(", ")}</span>
                      </span>
                    )}
                    {g.topRoutes.length > 0 && (
                      <span className="truncate max-w-md">
                        <span className="text-gray-500">Destinos:</span>{" "}
                        <span className="font-medium">{g.topRoutes.join(", ")}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {g.active > 0 && (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-200">
                        {g.active} {g.active === 1 ? "vigente" : "vigentes"}
                      </span>
                    )}
                    {g.soon > 0 && (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium border bg-yellow-100 text-yellow-800 border-yellow-200">
                        {g.soon} por vencer
                      </span>
                    )}
                    {g.expired > 0 && (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium border bg-red-100 text-red-800 border-red-200">
                        {g.expired} {g.expired === 1 ? "expirada" : "expiradas"}
                      </span>
                    )}
                  </div>
                </button>
                </div>

                {isOpen && (() => {
                  const showKinds = g.rates.some(hasAdditionalCosts);
                  return (
                  <div className="overflow-x-auto border-t border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 w-10" />
                          {[
                            "Carrier",
                            "Ruta",
                            "Tipo",
                            "SF",
                            "BL Fee",
                            ...(showKinds ? ["Kinds"] : []),
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
                        {g.rates.map((r) => (
                          <tr key={r.id} className="text-sm">
                            <td className="px-3 py-2 w-10">
                              <input
                                type="checkbox"
                                checked={selected.has(r.id)}
                                onChange={() => toggleOne(r.id)}
                                aria-label={`Seleccionar tarifa ${r.carrier} ${r.route}`}
                              />
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              {r.carrier ? (
                                <span
                                  className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                                  style={{ backgroundColor: carrierColor(r.carrier) }}
                                >
                                  {r.carrier}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">{r.route}</td>
                            <td className="px-4 py-2 whitespace-nowrap">{r.tipo}</td>
                            <td className="px-4 py-2 whitespace-nowrap">${r.sf}</td>
                            <td className="px-4 py-2 whitespace-nowrap">${r.blFee}</td>
                            {showKinds && (
                              <td
                                className="px-4 py-2 max-w-xs truncate text-xs"
                                title={formatRateKinds(r)}
                              >
                                {formatRateKinds(r)}
                              </td>
                            )}
                            <td className="px-4 py-2 whitespace-nowrap text-xs">
                              {formatDateCl(r.validFrom)} / {formatDateCl(r.validTo)}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <ValidityBadge validTo={r.validTo} />
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
                  </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
