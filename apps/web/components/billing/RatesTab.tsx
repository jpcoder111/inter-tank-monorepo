"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useLocalStore } from "./useLocalStore";
import { useBulkSelection } from "./useBulkSelection";
import BulkActionsBar from "./BulkActionsBar";
import RateIntake from "./RateIntake";
import {
  AGENT_SUGGESTIONS,
  CARRIER_SUGGESTIONS,
  CONTAINER_TYPE_SUGGESTIONS,
  RATES_STORAGE_KEY,
  Rate,
  SEED_RATES,
  ValidityStatus,
  agentColor,
  carrierColor,
  formatDateCl,
  getValidityStatus,
  normalizeRate,
  uid,
  uniqueSuggestions,
} from "./constants";

const emptyDraft: Omit<Rate, "id"> = {
  agent: "",
  carrier: "",
  route: "",
  tipo: "",
  sf: 0,
  blFee: 0,
  af: 0,
  afMax: 0,
  flexiArg: 0,
  thermalLinerChile20: 0,
  thermalLinerChile40: 0,
  thermalLinerMendoza20: 0,
  thermalLinerMendoza40: 0,
  fcaHaulageMendoza20: 0,
  fcaHaulageMendoza40: 0,
  discountInsulated: 0,
  additionalNotes: "",
  validFrom: "",
  validTo: "",
  notes: "",
};

// True if any of the optional cost columns has a meaningful value. Used to
// hide those columns in tables/forms when nobody in the dataset cares.
function hasAdditionalCosts(r: Rate): boolean {
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

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
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
    add,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<Rate, "id">>(emptyDraft);
  const [showIntake, setShowIntake] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const agentSuggestions = useMemo(
    () => uniqueSuggestions(items.map((r) => r.agent), AGENT_SUGGESTIONS),
    [items]
  );
  const carrierSuggestions = useMemo(
    () => uniqueSuggestions(items.map((r) => r.carrier), CARRIER_SUGGESTIONS),
    [items]
  );
  const routeSuggestions = useMemo(
    () => uniqueSuggestions(items.map((r) => r.route)),
    [items]
  );
  const tipoSuggestions = useMemo(
    () => uniqueSuggestions(items.map((r) => r.tipo), CONTAINER_TYPE_SUGGESTIONS),
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
    const map = new Map<string, Rate[]>();
    for (const r of filtered) {
      const key = r.agent.trim() || "(Sin agente)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries())
      .map(([agent, rates]) => summarizeAgent(agent, rates))
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
    setDraft(emptyDraft);
    setEditingId(null);
    setShowIntake(true);
    setShowForm(false);
    setShowAdditional(false);
  };

  const openEdit = (rate: Rate) => {
    const { id: _id, ...rest } = rate;
    void _id;
    setDraft(rest);
    setEditingId(rate.id);
    setShowIntake(false);
    setShowForm(true);
    // Auto-expand the optional costs section when the edited rate already has
    // values there — otherwise the user might miss they exist.
    setShowAdditional(hasAdditionalCosts(rate));
  };

  const handleExtracted = (data: Record<string, unknown>) => {
    setDraft({
      agent: toString(data.agent),
      carrier: toString(data.carrier),
      route: toString(data.route),
      tipo: toString(data.tipo),
      sf: toNumber(data.sf),
      blFee: toNumber(data.blFee),
      af: toNumber(data.af),
      afMax: toNumber(data.afMax),
      flexiArg: toNumber(data.flexiArg),
      thermalLinerChile20: toNumber(
        data.thermalLinerChile20 ?? data.thermalLiner20
      ),
      thermalLinerChile40: toNumber(
        data.thermalLinerChile40 ?? data.thermalLiner40
      ),
      thermalLinerMendoza20: toNumber(data.thermalLinerMendoza20),
      thermalLinerMendoza40: toNumber(data.thermalLinerMendoza40),
      fcaHaulageMendoza20: toNumber(
        data.fcaHaulageMendoza20 ?? data.fcaHaulage20
      ),
      fcaHaulageMendoza40: toNumber(
        data.fcaHaulageMendoza40 ?? data.fcaHaulage40
      ),
      discountInsulated: toNumber(data.discountInsulated),
      additionalNotes: toString(data.additionalNotes),
      validFrom: toString(data.validFrom),
      validTo: toString(data.validTo),
      notes: toString(data.notes),
    });
    setShowIntake(false);
    setShowForm(true);
  };

  const handleExtractedMany = (rows: Record<string, unknown>[]) => {
    console.log(
      "[debug-save] handleExtractedMany ENTRY, rows.length =",
      rows.length
    );
    // Pre-generate IDs OUTSIDE the setState updater so React StrictMode's
    // double-invocation can't produce different IDs on the two runs (which
    // could mask itself as "duplicates collapsed"). The index suffix also
    // guarantees uniqueness even if Date.now() and Math.random() happen to
    // collide for a row.
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const newRates: Rate[] = rows.map((row, idx) => ({
      id: `rate-${stamp}-${idx}-${rand}`,
      agent: toString(row.agent),
      carrier: toString(row.carrier),
      route: toString(row.route),
      tipo: toString(row.tipo),
      sf: toNumber(row.sf),
      blFee: toNumber(row.blFee),
      af: toNumber(row.af),
      afMax: toNumber(row.afMax),
      flexiArg: toNumber(row.flexiArg),
      thermalLinerChile20: toNumber(
        row.thermalLinerChile20 ?? row.thermalLiner20
      ),
      thermalLinerChile40: toNumber(
        row.thermalLinerChile40 ?? row.thermalLiner40
      ),
      thermalLinerMendoza20: toNumber(row.thermalLinerMendoza20),
      thermalLinerMendoza40: toNumber(row.thermalLinerMendoza40),
      fcaHaulageMendoza20: toNumber(
        row.fcaHaulageMendoza20 ?? row.fcaHaulage20
      ),
      fcaHaulageMendoza40: toNumber(
        row.fcaHaulageMendoza40 ?? row.fcaHaulage40
      ),
      discountInsulated: toNumber(row.discountInsulated),
      additionalNotes: toString(row.additionalNotes),
      validFrom: toString(row.validFrom),
      validTo: toString(row.validTo),
      notes: toString(row.notes),
    }));

    // [debug-save] temp: inputs to setItems and sanity-check the IDs are unique
    console.log(
      "[debug-save] saving",
      newRates.length,
      "rates",
      newRates.map((r) => r.id)
    );
    const idSet = new Set(newRates.map((r) => r.id));
    if (idSet.size !== newRates.length) {
      console.warn(
        "[debug-save] DUPLICATE IDs in newRates:",
        newRates.length - idSet.size
      );
    }
    // Reference uid here so the linter doesn't flag the unused import — we
    // intentionally bypassed uid() above for the deterministic-id pattern.
    void uid;

    setItems((prev) => {
      const next = [...prev, ...newRates];
      console.log(
        "[debug-save] setItems updater: prev.length =",
        prev.length,
        "→ next.length =",
        next.length
      );
      return next;
    });

    // localStorage is written inside setItemsState's callback; the setTimeout
    // gives React + the storage write time to flush before we read back.
    setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(RATES_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Rate[]) : [];
        console.log(
          "[debug-save] localStorage after save:",
          parsed.length,
          "rates persisted"
        );
      } catch (err) {
        console.warn("[debug-save] could not read back localStorage:", err);
      }
    }, 100);

    toast.success(
      `${rows.length} tarifa${rows.length === 1 ? "" : "s"} guardada${rows.length === 1 ? "" : "s"}`
    );
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
    } else {
      add({ ...draft, id: uid("rate") });
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

      {showIntake && (
        <div className="flex flex-col gap-2">
          <RateIntake
            type="rate"
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
            {editingId ? "Editar tarifa" : "Nueva tarifa"}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Agente
              <input
                type="text"
                list="rates-agent-sugg"
                value={draft.agent}
                onChange={(e) => setDraft({ ...draft, agent: e.target.value })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
              <datalist id="rates-agent-sugg">
                {agentSuggestions.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Carrier
              <input
                type="text"
                list="rates-carrier-sugg"
                value={draft.carrier}
                onChange={(e) => setDraft({ ...draft, carrier: e.target.value })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
              <datalist id="rates-carrier-sugg">
                {carrierSuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Ruta
              <input
                type="text"
                list="rates-route-sugg"
                value={draft.route}
                onChange={(e) => setDraft({ ...draft, route: e.target.value })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
              <datalist id="rates-route-sugg">
                {routeSuggestions.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Tipo
              <input
                type="text"
                list="rates-tipo-sugg"
                value={draft.tipo}
                onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
              <datalist id="rates-tipo-sugg">
                {tipoSuggestions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
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

          <div className="mt-4 border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={() => setShowAdditional((s) => !s)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 cursor-pointer"
              aria-expanded={showAdditional}
            >
              <span className="font-mono text-xs w-4 text-center">
                {showAdditional ? "▼" : "▶"}
              </span>
              Costos adicionales (Thermal Liner, Haulage FCA, descuentos)
            </button>
            {showAdditional && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <label className="flex flex-col gap-1 text-sm">
                  Thermal Chile 20&apos; (USD)
                  <input
                    type="number"
                    value={draft.thermalLinerChile20 ?? 0}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        thermalLinerChile20: Number(e.target.value),
                      })
                    }
                    className="border border-gray-200 rounded-md p-2 h-10"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Thermal Chile 40&apos; (USD)
                  <input
                    type="number"
                    value={draft.thermalLinerChile40 ?? 0}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        thermalLinerChile40: Number(e.target.value),
                      })
                    }
                    className="border border-gray-200 rounded-md p-2 h-10"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Thermal Mendoza 20&apos; (USD)
                  <input
                    type="number"
                    value={draft.thermalLinerMendoza20 ?? 0}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        thermalLinerMendoza20: Number(e.target.value),
                      })
                    }
                    className="border border-gray-200 rounded-md p-2 h-10"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Thermal Mendoza 40&apos; (USD)
                  <input
                    type="number"
                    value={draft.thermalLinerMendoza40 ?? 0}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        thermalLinerMendoza40: Number(e.target.value),
                      })
                    }
                    className="border border-gray-200 rounded-md p-2 h-10"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Haulage Mendoza 20&apos; (USD)
                  <input
                    type="number"
                    value={draft.fcaHaulageMendoza20 ?? 0}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fcaHaulageMendoza20: Number(e.target.value),
                      })
                    }
                    className="border border-gray-200 rounded-md p-2 h-10"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Haulage Mendoza 40&apos; (USD)
                  <input
                    type="number"
                    value={draft.fcaHaulageMendoza40 ?? 0}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fcaHaulageMendoza40: Number(e.target.value),
                      })
                    }
                    className="border border-gray-200 rounded-md p-2 h-10"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Descuento si insulado (USD)
                  <input
                    type="number"
                    value={draft.discountInsulated ?? 0}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        discountInsulated: Number(e.target.value),
                      })
                    }
                    className="border border-gray-200 rounded-md p-2 h-10"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm col-span-2 md:col-span-3">
                  Notas adicionales (condiciones, aplicación)
                  <input
                    type="text"
                    value={draft.additionalNotes ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        additionalNotes: e.target.value,
                      })
                    }
                    placeholder='Ej: "Descuento aplica solo si carga insulada"'
                    className="border border-gray-200 rounded-md p-2 h-10"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={cancelAll}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Guardar</Button>
          </div>
        </div>
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
                  const showExtra = g.rates.some(hasAdditionalCosts);
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
                            "AF",
                            "AF Max",
                            "Flexi ARG",
                            ...(showExtra
                              ? [
                                  "Thermal Chile 20'",
                                  "Thermal Chile 40'",
                                  "Thermal Mza 20'",
                                  "Thermal Mza 40'",
                                  "Haulage Mza 20'",
                                  "Haulage Mza 40'",
                                  "Desc. Insulado",
                                ]
                              : []),
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
                            <td className="px-4 py-2 whitespace-nowrap">${r.af}</td>
                            <td className="px-4 py-2 whitespace-nowrap">${r.afMax}</td>
                            <td className="px-4 py-2 whitespace-nowrap">${r.flexiArg}</td>
                            {showExtra && (
                              <>
                                <td className="px-4 py-2 whitespace-nowrap">
                                  ${r.thermalLinerChile20 ?? 0}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                  ${r.thermalLinerChile40 ?? 0}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                  ${r.thermalLinerMendoza20 ?? 0}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                  ${r.thermalLinerMendoza40 ?? 0}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                  ${r.fcaHaulageMendoza20 ?? 0}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                  ${r.fcaHaulageMendoza40 ?? 0}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                  {(r.discountInsulated ?? 0) > 0 ? (
                                    <span
                                      className="text-green-700"
                                      title={r.additionalNotes ?? ""}
                                    >
                                      -${r.discountInsulated}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              </>
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
