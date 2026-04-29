"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useLocalStore } from "./useLocalStore";
import { useBulkSelection } from "./useBulkSelection";
import BulkActionsBar from "./BulkActionsBar";
import NewRateFlow from "./NewRateFlow";
import {
  AGENT_SUGGESTIONS,
  CARRIER_SUGGESTIONS,
  ComercialName,
  ENTITIES_SEED,
  ENTITIES_STORAGE_KEY,
  Entity,
  RATES_STORAGE_KEY,
  Rate,
  SEED_RATES,
  ValidityStatus,
  agentColor,
  carrierColor,
  formatBatchVigencia,
  formatDateCl,
  formatRoute,
  getValidityStatus,
  normalizeRate,
  uniqueSuggestions,
} from "./constants";
import { ComercialBadge } from "./EntitiesTab";

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
  // Most-common (validFrom, validTo) pair across the agent's rates,
  // formatted via formatBatchVigencia ("Q2 2026" / "15/04/2026 –
  // 30/06/2026"). Empty when no rate carries validity dates.
  vigenciaLabel: string;
  // Status of the dominant vigencia: drives pill color.
  vigenciaStatus: ValidityStatus;
  // True when the agent has rates with multiple distinct (from, to)
  // pairs — happens for legacy data; post-v3.2 batches are uniform.
  vigenciaIsMixed: boolean;
};

function summarizeAgent(agent: string, rates: Rate[]): AgentSummary {
  const counts: Record<ValidityStatus, number> = { active: 0, soon: 0, expired: 0 };
  for (const r of rates) counts[getValidityStatus(r.validTo)]++;
  // Determine the dominant validity pair (most-common across rates).
  const validityCounts = new Map<string, number>();
  for (const r of rates) {
    const key = `${r.validFrom ?? ""}|${r.validTo ?? ""}`;
    if (key === "|") continue;
    validityCounts.set(key, (validityCounts.get(key) ?? 0) + 1);
  }
  const sortedValidity = Array.from(validityCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  const dominantKey = sortedValidity[0]?.[0] ?? "";
  const [domFrom = "", domTo = ""] = dominantKey.split("|");
  const vigenciaLabel = formatBatchVigencia(domFrom, domTo);
  const vigenciaStatus = domTo ? getValidityStatus(domTo) : "active";
  const vigenciaIsMixed = sortedValidity.length > 1;
  return {
    agent,
    rates,
    topCarriers: topByFrequency(rates.map((r) => r.carrier), 3),
    topRoutes: topByFrequency(rates.map((r) => r.route), 3),
    active: counts.active,
    soon: counts.soon,
    expired: counts.expired,
    vigenciaLabel,
    vigenciaStatus,
    vigenciaIsMixed,
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

  // Bundle 4 — entity catalog read-only; powers the per-card ComercialBadge.
  const { items: entities } = useLocalStore<Entity>(
    ENTITIES_STORAGE_KEY,
    ENTITIES_SEED
  );
  const comercialByAgent = useMemo(() => {
    const m = new Map<string, ComercialName>();
    for (const e of entities) {
      if (e.type !== "Agente") continue;
      m.set(e.name.trim().toLowerCase(), e.comercial);
    }
    return m;
  }, [entities]);

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
    // "BALGUERIE" / "balguerie") collapse into one card. The display
    // casing is the rate-count majority — same heuristic as the v3.3
    // migration — so the card label stays stable regardless of insertion
    // order even if the migration hasn't yet run on this browser.
    const map = new Map<string, Rate[]>();
    for (const r of filtered) {
      const trimmed = r.agent.trim();
      const key = trimmed ? trimmed.toLowerCase() : "(sin agente)";
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .map(([key, rates]) => {
        const counts = new Map<string, number>();
        for (const r of rates) {
          const display = r.agent.trim() || "(Sin agente)";
          counts.set(display, (counts.get(display) ?? 0) + 1);
        }
        let bestDisplay = key;
        let bestCount = -1;
        for (const [display, count] of counts) {
          if (count > bestCount) {
            bestCount = count;
            bestDisplay = display;
          }
        }
        return summarizeAgent(bestDisplay, rates);
      })
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

  // Mid-quarter adjustment (Fix 8): the operator picks a cutoff date,
  // every existing rate of the agent is closed at cutoff - 1 day, and
  // a clone of each is inserted with validFrom = cutoff and the
  // original validTo preserved. The user then edits the clones via
  // the existing per-row Editar flow to update SF / BL fee values.
  const [midQuarterModal, setMidQuarterModal] = useState<{
    agent: string;
    rates: Rate[];
  } | null>(null);
  const [midQuarterCutoff, setMidQuarterCutoff] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );

  const applyMidQuarterAdjustment = () => {
    if (!midQuarterModal) return;
    const cutoff = midQuarterCutoff.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) {
      toast.error("Fecha de corte inválida");
      return;
    }
    const cutoffDate = new Date(cutoff + "T00:00:00");
    if (Number.isNaN(cutoffDate.getTime())) {
      toast.error("Fecha de corte inválida");
      return;
    }
    const prev = new Date(cutoffDate);
    prev.setDate(prev.getDate() - 1);
    const cutoffMinus1 = prev.toISOString().slice(0, 10);
    const targetAgentLower = midQuarterModal.agent.trim().toLowerCase();
    const stamp = Date.now();
    const clones: Rate[] = midQuarterModal.rates.map((r, i) => ({
      ...r,
      id: `rate-${stamp}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      validFrom: cutoff,
      // Keep the original validTo so the clone runs from cutoff to the
      // batch end. Operator can extend or shorten via Editar.
      validTo: r.validTo,
    }));
    setItems((current) => {
      const closed = current.map((r) =>
        r.agent.trim().toLowerCase() === targetAgentLower
          ? { ...r, validTo: cutoffMinus1 }
          : r
      );
      return [...closed, ...clones];
    });
    toast.success(
      `Ajuste mid-quarter creado: ${midQuarterModal.rates.length} cerradas al ${cutoffMinus1}, ${clones.length} clonadas desde ${cutoff}`
    );
    setMidQuarterModal(null);
  };

  // Bulk save from NewRateFlow's preview. The component already
  // pre-generated IDs and applied common defaults (agent, validity, costs).
  // The Fix 7 duplicate flow may stamp existing rate ids onto incoming
  // rows when the user picks "Replace all" — this loop merges by id so
  // the existing entry is overwritten instead of duplicated.
  const handleSaveMany = (newRates: Rate[]) => {
    setItems((prev) => {
      const incoming = new Map<string, Rate>();
      for (const r of newRates) incoming.set(r.id, r);
      const replaced = prev.map((r) => incoming.get(r.id) ?? r);
      const replacedIds = new Set(prev.map((r) => r.id));
      const fresh = newRates.filter((r) => !replacedIds.has(r.id));
      return [...replaced, ...fresh];
    });
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

  // Auto-close the Edit modal when the rate it points at vanishes from
  // storage. Triggered by bulk delete (handleBulkDelete → removeMany), the
  // single-row Eliminar button on a different rate that happens to share
  // state, or any other future mutation that removes rates while a modal
  // is open. Without this, the user would be left staring at a modal
  // showing data for a rate that no longer exists, and clicking Guardar
  // would resurrect a ghost. Toast tells them what happened so the close
  // doesn't feel like a UI glitch.
  useEffect(() => {
    if (mode !== "edit" || !editingRate) return;
    const stillExists = rawItems.some((r) => r.id === editingRate.id);
    if (!stillExists) {
      setMode("list");
      setEditingRate(null);
      toast("La tarifa que estabas editando fue eliminada", { icon: "ℹ️" });
    }
  }, [mode, editingRate, rawItems]);

  if (!hydrated) {
    return <div className="text-gray-500 py-8 text-center">Cargando tarifas...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-md px-4 py-3 text-sm flex items-start gap-2">
        <span aria-hidden="true">ℹ️</span>
        <span>
          Las Tarifas mostradas <strong>NO incluyen EBS</strong>. El EBS se
          factura aparte vía Tabla EBS.
        </span>
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

      {/* Hide the agent-grouped catalog while the create/edit flow is open
          so the operator focuses on the new-rate form. The vertical stack
          of agent cards below the flow read as a "side panel" of agents
          and was the source of the persistent sidebar bug report. */}
      {mode === "list" && (groups.length === 0 ? (
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
                    {(() => {
                      const c = comercialByAgent.get(g.agent.trim().toLowerCase());
                      return c ? <ComercialBadge comercial={c} /> : null;
                    })()}
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
                    {g.vigenciaLabel && (() => {
                      const isExpired = g.vigenciaStatus === "expired";
                      const isSoon = g.vigenciaStatus === "soon";
                      const cls = isExpired
                        ? "bg-orange-50 text-orange-800 border-orange-200"
                        : isSoon
                          ? "bg-yellow-50 text-yellow-800 border-yellow-200"
                          : "bg-gray-100 text-gray-700 border-gray-200";
                      const suffix = isExpired
                        ? " (vencido)"
                        : isSoon
                          ? " (vence <30d)"
                          : "";
                      return (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}
                          title={
                            g.vigenciaIsMixed
                              ? "El agente tiene rates con vigencias mixtas — se muestra la dominante"
                              : "Vigencia del batch"
                          }
                        >
                          📅 {g.vigenciaLabel}
                          {suffix}
                          {g.vigenciaIsMixed ? " · mixto" : ""}
                        </span>
                      );
                    })()}
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMidQuarterModal({ agent: g.agent, rates: g.rates });
                  }}
                  className="px-2 py-1 mr-2 text-xs rounded border border-gray-300 bg-white hover:bg-gray-100 cursor-pointer self-center"
                  title="Cerrá las tarifas actuales en una fecha y cloná las nuevas para editarlas"
                >
                  ⏱️ Ajuste mid-Q
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
                            "Incoterm",
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
                            <td className="px-4 py-2 whitespace-nowrap">
                              {formatRoute(r.pol, r.pod, r.route)}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">{r.tipo}</td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              {(() => {
                                const inc = (r.incoterm ?? "").toString();
                                if (!inc)
                                  return <span className="text-gray-300">—</span>;
                                const isAmbiguous = inc === "FOB/CIF/CFR";
                                return (
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                      isAmbiguous
                                        ? "bg-gray-100 text-gray-700"
                                        : "bg-indigo-50 text-indigo-800"
                                    }`}
                                    title={
                                      isAmbiguous
                                        ? "Ambiguo: se resuelve al facturar"
                                        : `Incoterm: ${inc}`
                                    }
                                  >
                                    {inc}
                                  </span>
                                );
                              })()}
                            </td>
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
      ))}
      {midQuarterModal && (() => {
        const cutoff = midQuarterCutoff;
        const validCutoff = /^\d{4}-\d{2}-\d{2}$/.test(cutoff);
        const previewMinus1 = (() => {
          if (!validCutoff) return "";
          const d = new Date(cutoff + "T00:00:00");
          if (Number.isNaN(d.getTime())) return "";
          d.setDate(d.getDate() - 1);
          return d.toISOString().slice(0, 10);
        })();
        const sample = midQuarterModal.rates[0];
        const sampleValidTo = sample?.validTo ?? "";
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setMidQuarterModal(null)}
          >
            <div
              className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 p-5 flex flex-col gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="font-semibold text-base">
                Ajuste mid-quarter — {midQuarterModal.agent}
              </h4>
              <p className="text-sm text-gray-700">
                Cerrá las {midQuarterModal.rates.length} tarifa
                {midQuarterModal.rates.length === 1 ? "" : "s"} actuales en
                una fecha y cloná versiones nuevas desde esa fecha para
                editar SF / BL Fee.
              </p>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Fecha de corte</span>
                <input
                  type="date"
                  value={midQuarterCutoff}
                  onChange={(e) => setMidQuarterCutoff(e.target.value)}
                  className="border border-gray-200 rounded-md p-2 h-10"
                />
              </label>
              {validCutoff && previewMinus1 && (
                <div className="text-xs bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-col gap-1">
                  <div>
                    Las {midQuarterModal.rates.length} tarifas actuales se
                    cerrarán al{" "}
                    <strong>{formatDateCl(previewMinus1)}</strong>.
                  </div>
                  <div>
                    Se clonarán {midQuarterModal.rates.length} tarifas con{" "}
                    <strong>validFrom {formatDateCl(cutoff)}</strong>
                    {sampleValidTo
                      ? ` y validTo ${formatDateCl(sampleValidTo)}`
                      : ""}
                    . Editá SF / BL Fee desde la lista del agente.
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setMidQuarterModal(null)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={applyMidQuarterAdjustment}
                  disabled={!validCutoff}
                >
                  Crear ajuste
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
