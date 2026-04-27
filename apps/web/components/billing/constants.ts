export const AGENT_SUGGESTIONS = [
  "IWS",
  "Van Moer",
  "Asstra",
  "HCL",
  "Scan",
  "CCL",
  "BULLET",
] as const;

export const CARRIER_SUGGESTIONS = [
  "OOCL",
  "HAPAG",
  "CMA-CGM",
  "PIL",
  "COSCO",
  "Evergreen",
  "MSC",
] as const;

export const CONTAINER_TYPE_SUGGESTIONS = [
  "20'",
  "Flexi",
  "20'-Flexi",
  "40'",
  "40'HC",
  "20'RF",
  "40'RF",
] as const;

// EBS aplica por región/tráfico, no por puerto específico. Estas regiones
// alimentan el datalist del campo "Tráfico" pero el campo es texto libre.
export const EBS_TRAFFIC_SUGGESTIONS = [
  "Chile - Norte de Europa",
  "Chile - USA",
  "Chile - Canadá",
  "Chile - Asia",
  "Chile - Intraamérica",
  "Chile - Mediterráneo",
  "Chile - Oceanía",
] as const;

export const AGENT_COLORS: Record<string, string> = {
  IWS: "#d9ead3",
  "Van Moer": "#cfe2f3",
  Asstra: "#d9d2e9",
  HCL: "#fce5cd",
  Scan: "#d0e0e3",
  CCL: "#eaf2fb",
  BULLET: "#f5eef8",
};

export const AGENT_COLOR_FALLBACK = "#f3f4f6";

// 20-color pastel palette used to auto-assign a row background to agents the
// user adds that aren't in AGENT_COLORS. Picked to be visually distinct from
// the predefined set above — no near-duplicates.
const PASTEL_PALETTE = [
  "#ffe4e1", "#e0f7fa", "#fff3e0", "#f3e5f5", "#e8f5e9",
  "#fff9c4", "#e3f2fd", "#fce4ec", "#f0f4c3", "#e1f5fe",
  "#ffecb3", "#dcedc8", "#ffe0b2", "#cfd8dc", "#d1c4e9",
  "#b2dfdb", "#ffccbc", "#c5cae9", "#f8bbd0", "#bbdefb",
] as const;

const AGENT_COLORS_KEY = "it_agent_colors";

// Module-level cache of dynamically-assigned colors. Loaded lazily on first
// read from localStorage; mutations write back. Module state is fine because
// every consumer of this is a "use client" component — there's no server
// rendering path that needs to coordinate.
let dynamicAgentColors: Record<string, string> | null = null;

function loadDynamicAgentColors(): Record<string, string> {
  if (dynamicAgentColors !== null) return dynamicAgentColors;
  if (typeof window === "undefined") {
    dynamicAgentColors = {};
    return dynamicAgentColors;
  }
  try {
    const raw = window.localStorage.getItem(AGENT_COLORS_KEY);
    dynamicAgentColors = raw
      ? (JSON.parse(raw) as Record<string, string>)
      : {};
  } catch {
    dynamicAgentColors = {};
  }
  return dynamicAgentColors;
}

function persistDynamicAgentColors() {
  if (typeof window === "undefined" || !dynamicAgentColors) return;
  try {
    window.localStorage.setItem(
      AGENT_COLORS_KEY,
      JSON.stringify(dynamicAgentColors)
    );
  } catch {
    // ignore quota / storage disabled
  }
}

// Resolves an agent name to a pastel background color. Predefined agents win;
// previously-seen new agents return their cached assignment; truly new agents
// pick the next unused color from the palette and persist the mapping so the
// color is stable across sessions.
export function agentColor(agent: string): string {
  if (!agent) return AGENT_COLOR_FALLBACK;
  if (AGENT_COLORS[agent]) return AGENT_COLORS[agent]!;
  const cache = loadDynamicAgentColors();
  if (cache[agent]) return cache[agent]!;
  const used = new Set<string>([
    ...Object.values(AGENT_COLORS),
    ...Object.values(cache),
  ]);
  const next =
    PASTEL_PALETTE.find((c) => !used.has(c)) ??
    // All distinct colors taken — cycle through the palette deterministically
    // by agent count.
    PASTEL_PALETTE[Object.keys(cache).length % PASTEL_PALETTE.length]!;
  cache[agent] = next;
  persistDynamicAgentColors();
  return next;
}

// Colores institucionales suaves por naviera. Se usan como fondo de fila en
// EbsTab y como chip/cell highlight en el resto de la app donde aparece la
// naviera.
export const CARRIER_COLORS: Record<string, string> = {
  OOCL: "#e8eaed",
  HAPAG: "#fff0e0",
  "CMA-CGM": "#e8f0fe",
  "CMA CGM": "#e8f0fe",
  MSC: "#f5f0e8",
  Evergreen: "#e0f2e0",
  PIL: "#fde0e0",
  ONE: "#fce4ec",
  "Yang Ming": "#e8f5e9",
  COSCO: "#e0f0f0",
  ZIM: "#e8e0f0",
};

export const CARRIER_COLOR_FALLBACK = "#f3f4f6";

// Resolves a carrier name to its brand color, tolerant of dash/space variants
// ("CMA-CGM" vs "CMA CGM" vs "cma cgm"). Returns the neutral fallback for
// unknown carriers.
export function carrierColor(carrier: string): string {
  if (!carrier) return CARRIER_COLOR_FALLBACK;
  const direct = CARRIER_COLORS[carrier];
  if (direct) return direct;
  for (const key of Object.keys(CARRIER_COLORS)) {
    if (carriersMatch(key, carrier)) return CARRIER_COLORS[key]!;
  }
  return CARRIER_COLOR_FALLBACK;
}

// Storage keys are version-suffixed: bump when the schema or seed changes so
// existing localStorage data is replaced with the new seeds on next load.
export const RATES_STORAGE_KEY = "it_rates_v2";
export const EBS_STORAGE_KEY = "it_ebs_v4";
export const LOCAL_STD_STORAGE_KEY = "it_local_std";
export const LOCAL_EXCEPTIONS_STORAGE_KEY = "it_local_exceptions_v2";
export const ARG_CLIENTS_STORAGE_KEY = "it_arg_clients_v2";
export const INVOICED_BLS_KEY = "it_invoiced_bls";
export const INVOICE_HISTORY_PREFIX = "it_invoiced_history_";

export function invoiceHistoryKey(userId: string): string {
  return `${INVOICE_HISTORY_PREFIX}${userId}`;
}

export type InvoicedBL = {
  bl: string;
  invoicedAt: string;
  userId: string;
  userName: string;
};

export type InvoicedBLsRegistry = Record<string, InvoicedBL>;

export type InvoiceHistoryRow = {
  blNumber: string;
  agent: string;
  carrier: string;
  route: string;
  tipo: string;
  bls: number;
  ctrs: number;
  total: number | string;
};

export type InvoiceHistoryEntry = {
  id: string;
  invoicedAt: string;
  userId: string;
  userName: string;
  blCount: number;
  bls: string[];
  rows: InvoiceHistoryRow[];
  filterSummary: string;
};

export type Rate = {
  id: string;
  agent: string;
  carrier: string;
  route: string;
  // Port of Loading / origen. Used to decide which thermal/haulage
  // variant applies — Mendoza (or Argentinian) origins get the Mendoza
  // values, everything else gets the Chile values. Optional because
  // legacy records pre-date this field.
  pol?: string;
  tipo: string;
  sf: number;
  blFee: number;
  af: number;
  afMax: number;
  flexiArg: number;
  // Per-origin Thermal Liner / Insulado costs and FCA Haulage from Mendoza.
  // Filled per-row regardless of the row's container size — the invoicing
  // logic picks Chile-vs-Mendoza based on the BL's shipper.
  thermalLinerChile20?: number;
  thermalLinerChile40?: number;
  thermalLinerMendoza20?: number;
  thermalLinerMendoza40?: number;
  fcaHaulageMendoza20?: number;
  fcaHaulageMendoza40?: number;
  discountInsulated?: number;
  additionalNotes?: string;
  // Legacy fields (single Thermal Liner pair, single Haulage pair). Kept on
  // the type so older localStorage records still validate; normalizeRate
  // copies them into the new Chile/Mendoza-split fields on read.
  thermalLiner20?: number;
  thermalLiner40?: number;
  fcaHaulage20?: number;
  fcaHaulage40?: number;
  validFrom: string;
  validTo: string;
  notes: string;
};

// Normalizes legacy rate records to the new schema. Idempotent: rates that
// already have the *Chile/Mendoza fields are returned unchanged. The legacy
// thermalLiner20/40 are mapped to thermalLinerChile20/40 because the original
// schema described "Thermal Liner from Chile origin".
export function normalizeRate(r: Rate): Rate {
  const out: Rate = { ...r };
  if (out.thermalLinerChile20 == null && out.thermalLiner20 != null) {
    out.thermalLinerChile20 = out.thermalLiner20;
  }
  if (out.thermalLinerChile40 == null && out.thermalLiner40 != null) {
    out.thermalLinerChile40 = out.thermalLiner40;
  }
  if (out.fcaHaulageMendoza20 == null && out.fcaHaulage20 != null) {
    out.fcaHaulageMendoza20 = out.fcaHaulage20;
  }
  if (out.fcaHaulageMendoza40 == null && out.fcaHaulage40 != null) {
    out.fcaHaulageMendoza40 = out.fcaHaulage40;
  }
  return out;
}

export type EbsTipo = "Dry" | "Reefer";

export type Ebs = {
  id: string;
  carrier: string;
  traffic: string;
  // Reefer EBS rates often differ from Dry — they live in separate rows so
  // each can have its own validity window and amount. Legacy records (added
  // before this field existed) should be coerced to "Dry" by the reader.
  tipo: EbsTipo;
  amountPerTEU: number;
  validFrom: string;
  validTo: string;
  notes: string;
};

// Coerces legacy Ebs records (saved before `tipo` existed) so reads always
// produce a fully-typed value. New seeds and saves include `tipo` explicitly.
export function normalizeEbs(e: Ebs): Ebs {
  return { ...e, tipo: e.tipo ?? "Dry" };
}

export const SEED_RATES: Rate[] = [
  {
    id: "seed-iws-rha-20flexi",
    agent: "IWS",
    carrier: "OOCL",
    route: "Rotterdam-Hamburg-Antwerp-London",
    tipo: "20'-Flexi",
    sf: 700,
    blFee: 38,
    af: 75,
    afMax: 300,
    flexiArg: 800,
    validFrom: "2026-01-01",
    validTo: "2026-06-30",
    notes: "",
  },
  {
    id: "seed-iws-rha-40",
    agent: "IWS",
    carrier: "OOCL",
    route: "Rotterdam-Hamburg-Antwerp-London",
    tipo: "40'",
    sf: 900,
    blFee: 38,
    af: 75,
    afMax: 300,
    flexiArg: 0,
    validFrom: "2026-01-01",
    validTo: "2026-06-30",
    notes: "",
  },
  {
    id: "seed-iws-cph-20flexi",
    agent: "IWS",
    carrier: "OOCL",
    route: "Copenhagen",
    tipo: "20'-Flexi",
    sf: 1100,
    blFee: 38,
    af: 75,
    afMax: 300,
    flexiArg: 0,
    validFrom: "2026-01-01",
    validTo: "2026-06-30",
    notes: "",
  },
  {
    id: "seed-iws-cph-40",
    agent: "IWS",
    carrier: "OOCL",
    route: "Copenhagen",
    tipo: "40'",
    sf: 1200,
    blFee: 38,
    af: 75,
    afMax: 300,
    flexiArg: 0,
    validFrom: "2026-01-01",
    validTo: "2026-06-30",
    notes: "",
  },
  {
    id: "seed-vanmoer-rha-20flexi",
    agent: "Van Moer",
    carrier: "OOCL",
    route: "Rotterdam-Hamburg-Antwerp-London",
    tipo: "20'-Flexi",
    sf: 580,
    blFee: 40,
    af: 0,
    afMax: 0,
    flexiArg: 0,
    validFrom: "2026-01-01",
    validTo: "2026-06-30",
    notes: "",
  },
  {
    id: "seed-vanmoer-rha-40",
    agent: "Van Moer",
    carrier: "OOCL",
    route: "Rotterdam-Hamburg-Antwerp-London",
    tipo: "40'",
    sf: 695,
    blFee: 40,
    af: 0,
    afMax: 0,
    flexiArg: 800,
    validFrom: "2026-01-01",
    validTo: "2026-06-30",
    notes: "",
  },
  {
    id: "seed-asstra-klriga-40",
    agent: "Asstra",
    carrier: "OOCL",
    route: "Klaipeda-Riga",
    tipo: "40'",
    sf: 1600,
    blFee: 60,
    af: 0,
    afMax: 0,
    flexiArg: 0,
    validFrom: "2026-04-01",
    validTo: "2026-06-30",
    notes: "",
  },
  {
    id: "seed-ccl-londongw-40",
    agent: "CCL",
    carrier: "OOCL",
    route: "London Gateway",
    tipo: "40'",
    sf: 970,
    blFee: 85,
    af: 0,
    afMax: 0,
    flexiArg: 0,
    validFrom: "2026-04-01",
    validTo: "2026-06-30",
    notes: "EBS variable por línea",
  },
  {
    id: "seed-bullet-grangemouth-40",
    agent: "BULLET",
    carrier: "HAPAG",
    route: "Grangemouth",
    tipo: "40'",
    sf: 1800,
    blFee: 80,
    af: 0,
    afMax: 0,
    flexiArg: 0,
    validFrom: "2026-01-01",
    validTo: "2026-06-30",
    notes: "",
  },
  {
    id: "seed-hcl-rotterdam-flexi",
    agent: "HCL",
    carrier: "CMA-CGM",
    route: "Rotterdam",
    tipo: "Flexi",
    sf: 2905,
    blFee: 0,
    af: 0,
    afMax: 0,
    flexiArg: 0,
    validFrom: "2026-04-01",
    validTo: "2026-06-30",
    notes: "All-in FCA: trucking + local + Flexibag + OF + EBS incluido",
  },
  {
    id: "seed-scan-cph-20",
    agent: "Scan",
    carrier: "OOCL",
    route: "Copenhagen",
    tipo: "20'",
    sf: 1300,
    blFee: 0,
    af: 0,
    afMax: 0,
    flexiArg: 0,
    validFrom: "2025-10-01",
    validTo: "2026-03-31",
    notes: "BL fee pendiente — tarifa expirada",
  },
];

export const SEED_EBS: Ebs[] = [
  {
    id: "seed-ebs-oocl-cl-neu",
    carrier: "OOCL",
    traffic: "Chile - Norte de Europa",
    tipo: "Dry",
    amountPerTEU: 126,
    validFrom: "2026-04-01",
    validTo: "2026-06-30",
    notes: "Cubre Rotterdam, Hamburg, Antwerp, London, Copenhagen, Klaipeda, etc.",
  },
  {
    id: "seed-ebs-hapag-cl-neu",
    carrier: "HAPAG",
    traffic: "Chile - Norte de Europa",
    tipo: "Dry",
    amountPerTEU: 160,
    validFrom: "2026-04-01",
    validTo: "2026-06-30",
    notes: "Cubre Grangemouth, Rotterdam, Hamburg, etc.",
  },
  {
    id: "seed-ebs-cma-cl-neu",
    carrier: "CMA-CGM",
    traffic: "Chile - Norte de Europa",
    tipo: "Dry",
    amountPerTEU: 160,
    validFrom: "2026-04-01",
    validTo: "2026-06-30",
    notes: "Incluido en all-in HCL",
  },
];

// ===== EBS row helpers =====

// vigente   = row is the most recent (newest validFrom) for its slot
//             and either has no validTo or validTo is more than 30 days away
// soon      = row is the most recent for its slot but expires within 30 days
// reemplazado = there exists a newer record for the same slot
export type EbsRowStatus = "vigente" | "soon" | "reemplazado";

export type EbsRowMeta = {
  status: EbsRowStatus;
  hasOverlap: boolean;
};

// A "slot" is the unique combination an invoicing lookup can target:
// carrier + traffic + tipo. Reefer and Dry are independent slots so a
// vigente Dry and a vigente Reefer can coexist for the same carrier+traffic.
function ebsSlotKey(e: Pick<Ebs, "carrier" | "traffic" | "tipo">): string {
  return `${e.carrier.trim().toLowerCase().replace(/[\s-]+/g, "")}|${e.traffic.trim().toLowerCase()}|${e.tipo ?? "Dry"}`;
}

function rangesOverlap(a: Ebs, b: Ebs): boolean {
  const aStart = a.validFrom || "";
  const aEnd = a.validTo || "9999-12-31";
  const bStart = b.validFrom || "";
  const bEnd = b.validTo || "9999-12-31";
  return aStart <= bEnd && bStart <= aEnd;
}

// Days between today (00:00 local) and an ISO yyyy-mm-dd string. Negative if
// the date is in the past. Returns Infinity for empty/unparseable inputs so
// the caller can treat "no validTo" as "very far away".
function daysUntil(iso: string): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// For each EBS row, computes whether it is the currently-vigente record for
// its (carrier, traffic, tipo) slot — defined as the row with the most recent
// validFrom — and whether it overlaps in time with any other row in the same
// slot. Returns a Map keyed by row id.
export function computeEbsRowMeta(items: Ebs[]): Map<string, EbsRowMeta> {
  const groups = new Map<string, Ebs[]>();
  for (const e of items) {
    const key = ebsSlotKey(e);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const out = new Map<string, EbsRowMeta>();
  for (const group of groups.values()) {
    const sorted = group
      .slice()
      .sort((a, b) => b.validFrom.localeCompare(a.validFrom));
    sorted.forEach((e, idx) => {
      let status: EbsRowStatus;
      if (idx !== 0) {
        status = "reemplazado";
      } else {
        const days = daysUntil(e.validTo);
        status = days < 30 ? "soon" : "vigente";
      }
      out.set(e.id, { status, hasOverlap: false });
    });
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (rangesOverlap(group[i]!, group[j]!)) {
          out.get(group[i]!.id)!.hasOverlap = true;
          out.get(group[j]!.id)!.hasOverlap = true;
        }
      }
    }
  }
  return out;
}

// Resolves the EBS row that should price a specific carrier + tipo
// combination. Returns the most recent matching row (validFrom desc) or
// undefined when no match exists. NOTE: there is intentionally no Dry-fallback
// for Reefer cargo — if the user hasn't entered a Reefer EBS for the slot,
// invoicing should leave it as TBD.
export function findEbsForBilling(
  items: Ebs[],
  carrier: string,
  tipo: EbsTipo
): Ebs | undefined {
  const matches = items.filter(
    (e) => carriersMatch(e.carrier, carrier) && (e.tipo ?? "Dry") === tipo
  );
  if (matches.length === 0) return undefined;
  return matches
    .slice()
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
}

export type ValidityStatus = "expired" | "soon" | "active";

export function getValidityStatus(validTo: string): ValidityStatus {
  if (!validTo) return "active";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(validTo);
  if (Number.isNaN(end.getTime())) return "active";
  const diffDays = Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "soon";
  return "active";
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Display helper: stored dates are always ISO yyyy-mm-dd (because <input type="date">
// requires that and string-sort matches chronological order). For UI we render in
// Chilean format dd/mm/yyyy.
export function formatDateCl(value: string | null | undefined): string {
  if (!value) return "-";
  const trimmed = value.trim();
  if (!trimmed) return "-";
  // Already dd/mm/yyyy — pass through
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) return trimmed;
  // ISO yyyy-mm-dd (with optional time component)
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${d!.padStart(2, "0")}/${m!.padStart(2, "0")}/${y}`;
  }
  return trimmed;
}

export function uniqueSuggestions(
  existing: string[],
  defaults: readonly string[] = []
): string[] {
  const set = new Set<string>();
  for (const d of defaults) set.add(d);
  for (const e of existing) {
    const v = (e ?? "").trim();
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// ===== Local charges (Gastos Locales) =====

export type LocalStandardRate = {
  id: string;
  name: string;
  othcDry: number;
  othcReefer: number;
  sello: number;
  ams: number;
  blFee: number;
  gateOutDry: number;
  gateOutReefer: number;
  gateOutConditions: string;
  validFrom: string;
  notes: string;
};

export type LocalExceptionTipo = "Dry" | "Reefer";

export type LocalException = {
  id: string;
  customer: string;
  carrier: string;
  tipo: LocalExceptionTipo;
  othc: number;
  sello: number;
  ams: number;
  blFee: number;
  gateOut: number;
  gateOutPorts: string;
  gateOutUnitTypes: string;
  otherCharges: number;
  otherChargesDetail: string;
  // Marcas/empresas subsidiarias del cliente que también heredan esta excepción
  // cuando aparecen como shipper en el BL. Texto libre separado por comas.
  includedBrands: string;
  notes: string;
  validFrom: string;
};

export const LOCAL_GATE_OUT_CONDITIONS_DEFAULT =
  "Solo aplica para navieras CMA-CGM, PIL, OOCL y COSCO. Yang Ming: solo algunos destinos Asia.";

export const CUSTOMER_SUGGESTIONS = [
  "Concha y Toro",
  "Mipster – IWS",
  "De Martino / Santa Teresa",
] as const;

export const LOCAL_CARRIER_SUGGESTIONS = [
  "OOCL",
  "HAPAG",
  "CMA-CGM",
  "CMA CGM",
  "PIL",
  "COSCO",
  "Evergreen",
  "MSC",
  "Yang Ming",
  "Todas las navieras",
] as const;

export const CUSTOMER_COLORS: Record<string, string> = {
  "Concha y Toro": "#d9ead3",
  "Mipster – IWS": "#cfe2f3",
  "De Martino / Santa Teresa": "#d9d2e9",
};

export const SEED_LOCAL_STANDARDS: LocalStandardRate[] = [
  {
    id: "seed-local-std-default-20260303",
    name: "Estándar",
    othcDry: 185,
    othcReefer: 315,
    sello: 35,
    ams: 40,
    blFee: 60,
    gateOutDry: 185,
    gateOutReefer: 205,
    gateOutConditions: LOCAL_GATE_OUT_CONDITIONS_DEFAULT,
    validFrom: "2026-03-03",
    notes: "Informado por Bárbara",
  },
  {
    id: "seed-local-std-sanclemente-20260303",
    name: "San Clemente",
    othcDry: 165,
    othcReefer: 315,
    sello: 35,
    ams: 40,
    blFee: 60,
    gateOutDry: 185,
    gateOutReefer: 205,
    gateOutConditions: LOCAL_GATE_OUT_CONDITIONS_DEFAULT,
    validFrom: "2026-03-03",
    notes: "",
  },
];

export const CONCHA_Y_TORO_BRANDS = "Viña Maipo, Cono Sur";

export const SEED_LOCAL_EXCEPTIONS: LocalException[] = [
  {
    id: "seed-exc-mipster-iws-dry",
    customer: "Mipster – IWS",
    carrier: "Todas las navieras",
    tipo: "Dry",
    othc: 135,
    sello: 35,
    ams: 40,
    blFee: 60,
    gateOut: 105,
    gateOutPorts: "",
    gateOutUnitTypes: "",
    otherCharges: 0,
    otherChargesDetail: "",
    includedBrands: "",
    notes: "Gate Out solo cuando la naviera corresponda (ver condiciones estándar)",
    validFrom: "2026-03-03",
  },
  {
    id: "seed-exc-cyt-oocl-dry",
    customer: "Concha y Toro",
    carrier: "OOCL",
    tipo: "Dry",
    othc: 100,
    sello: 0,
    ams: 0,
    blFee: 0,
    gateOut: 110,
    gateOutPorts: "",
    gateOutUnitTypes: "",
    otherCharges: 22,
    otherChargesDetail: "Security Surcharge 10/unit + TPO TPA 12/unit + Doc Fee 38/BL",
    includedBrands: CONCHA_Y_TORO_BRANDS,
    notes: "",
    validFrom: "2026-03-03",
  },
  {
    id: "seed-exc-cyt-evergreen-dry",
    customer: "Concha y Toro",
    carrier: "Evergreen",
    tipo: "Dry",
    othc: 100,
    sello: 0,
    ams: 0,
    blFee: 50,
    gateOut: 0,
    gateOutPorts: "",
    gateOutUnitTypes: "",
    otherCharges: 0,
    otherChargesDetail: "",
    includedBrands: CONCHA_Y_TORO_BRANDS,
    notes: "",
    validFrom: "2026-03-03",
  },
  {
    id: "seed-exc-cyt-pil-dry",
    customer: "Concha y Toro",
    carrier: "PIL",
    tipo: "Dry",
    othc: 110,
    sello: 0,
    ams: 0,
    blFee: 40,
    gateOut: 120,
    gateOutPorts: "",
    gateOutUnitTypes: "",
    otherCharges: 0,
    otherChargesDetail: "",
    includedBrands: CONCHA_Y_TORO_BRANDS,
    notes: "",
    validFrom: "2026-03-03",
  },
  {
    id: "seed-exc-cyt-cma-dry",
    customer: "Concha y Toro",
    carrier: "CMA CGM",
    tipo: "Dry",
    othc: 135,
    sello: 30,
    ams: 0,
    blFee: 60,
    gateOut: 100,
    gateOutPorts: "",
    gateOutUnitTypes: "",
    otherCharges: 0,
    otherChargesDetail: "",
    includedBrands: CONCHA_Y_TORO_BRANDS,
    notes: "",
    validFrom: "2026-03-03",
  },
  {
    id: "seed-exc-cyt-yangming-dry",
    customer: "Concha y Toro",
    carrier: "Yang Ming",
    tipo: "Dry",
    othc: 0,
    sello: 0,
    ams: 0,
    blFee: 0,
    gateOut: 190,
    gateOutPorts: "Configurar puertos específicos",
    gateOutUnitTypes: "Configurar tipos de unidad",
    otherCharges: 0,
    otherChargesDetail: "",
    includedBrands: CONCHA_Y_TORO_BRANDS,
    notes: "No se cobra siempre — solo algunos puertos y tipos de unidad",
    validFrom: "2026-03-03",
  },
  {
    id: "seed-exc-demartino-reefer",
    customer: "De Martino / Santa Teresa",
    carrier: "Todas las navieras",
    tipo: "Reefer",
    othc: 200,
    sello: 0,
    ams: 0,
    blFee: 60,
    gateOut: 140,
    gateOutPorts: "",
    gateOutUnitTypes: "",
    otherCharges: 0,
    otherChargesDetail: "",
    includedBrands: "",
    notes: "",
    validFrom: "2026-03-03",
  },
];

// ===== Local charge matching =====
// "CMA-CGM" must equal "CMA CGM" must equal "cma-cgm".
function normalizeCarrier(c: string): string {
  return c.toLowerCase().replace(/[\s-]+/g, "");
}

export function carriersMatch(a: string, b: string): boolean {
  return normalizeCarrier(a) === normalizeCarrier(b);
}

// True when a shipper name matches the exception's customer field directly OR
// any of the brands listed in includedBrands (comma/semicolon separated).
export function shipperMatchesException(
  shipper: string,
  exception: Pick<LocalException, "customer" | "includedBrands">
): boolean {
  const s = shipper.trim().toLowerCase();
  if (!s) return false;
  if (exception.customer.trim().toLowerCase() === s) return true;
  const brands = exception.includedBrands
    .split(/[,;]/)
    .map((b) => b.trim().toLowerCase())
    .filter(Boolean);
  return brands.includes(s);
}

export function containerTipoToLocalTipo(tipo: string): LocalExceptionTipo {
  const t = tipo.toUpperCase();
  return t.includes("RF") || t.includes("REEFER") ? "Reefer" : "Dry";
}

// Standard Gate Out only applies to a fixed carrier list per
// LOCAL_GATE_OUT_CONDITIONS_DEFAULT. Yang Ming is excluded from auto-apply
// because the standard says "solo algunos destinos Asia" — too freeform to
// auto-resolve without destination metadata.
const STD_GATE_OUT_CARRIERS = ["CMA-CGM", "PIL", "OOCL", "COSCO"];

export function carrierGetsStandardGateOut(carrier: string): boolean {
  return STD_GATE_OUT_CARRIERS.some((c) => carriersMatch(c, carrier));
}

// Pick the current standard rate by name with the latest validFrom. Defaults
// to "Estándar"; falls back to whatever is most recent if that name is absent.
export function pickCurrentStandard(
  standards: LocalStandardRate[],
  preferredName: string = "Estándar"
): LocalStandardRate | undefined {
  const byName = new Map<string, LocalStandardRate>();
  for (const s of standards) {
    const existing = byName.get(s.name);
    if (!existing || s.validFrom > existing.validFrom) {
      byName.set(s.name, s);
    }
  }
  return (
    byName.get(preferredName) ??
    Array.from(byName.values()).sort((a, b) =>
      b.validFrom.localeCompare(a.validFrom)
    )[0]
  );
}

export function findLocalException(
  exceptions: LocalException[],
  shipper: string,
  carrier: string,
  localTipo: LocalExceptionTipo
): LocalException | undefined {
  return exceptions.find((e) => {
    if (e.tipo !== localTipo) return false;
    const carrierOk =
      e.carrier.toLowerCase().includes("todas") ||
      carriersMatch(e.carrier, carrier);
    if (!carrierOk) return false;
    return shipperMatchesException(shipper, e);
  });
}

export type LocalChargeBreakdown = {
  matchedException: LocalException | undefined;
  appliedStandard: LocalStandardRate | undefined;
  othc: number;
  sello: number;
  ams: number;
  blFee: number;
  gateOut: number;
  otherCharges: number;
  total: number;
  // Charges that exist in the exception but require manual review (e.g.,
  // Gate Out limited to specific ports/units that we can't auto-resolve).
  conditional: string[];
  // Reason this row has no charges resolved. Empty when fully resolved.
  unresolved: string[];
};

export function computeLocalCharges(args: {
  shipper: string;
  carrier: string;
  tipo: string;
  bls: number;
  ctrs: number;
  exceptions: LocalException[];
  standards: LocalStandardRate[];
}): LocalChargeBreakdown {
  const { shipper, carrier, tipo, bls, ctrs, exceptions, standards } = args;
  const empty: LocalChargeBreakdown = {
    matchedException: undefined,
    appliedStandard: undefined,
    othc: 0,
    sello: 0,
    ams: 0,
    blFee: 0,
    gateOut: 0,
    otherCharges: 0,
    total: 0,
    conditional: [],
    unresolved: [],
  };

  if (!carrier || !tipo) {
    return { ...empty, unresolved: ["carrier/tipo"] };
  }

  const localTipo = containerTipoToLocalTipo(tipo);
  const exception = shipper
    ? findLocalException(exceptions, shipper, carrier, localTipo)
    : undefined;

  if (exception) {
    const conditional: string[] = [];
    let gateOut = 0;
    if (exception.gateOut > 0) {
      const hasFilters =
        exception.gateOutPorts.trim() !== "" ||
        exception.gateOutUnitTypes.trim() !== "";
      if (hasFilters) {
        conditional.push("gateOut");
      } else {
        gateOut = exception.gateOut * ctrs;
      }
    }
    const othc = exception.othc * ctrs;
    const sello = exception.sello * ctrs;
    const ams = exception.ams * bls;
    const blFee = exception.blFee * bls;
    const otherCharges = exception.otherCharges * ctrs;
    return {
      matchedException: exception,
      appliedStandard: undefined,
      othc,
      sello,
      ams,
      blFee,
      gateOut,
      otherCharges,
      total: othc + sello + ams + blFee + gateOut + otherCharges,
      conditional,
      unresolved: [],
    };
  }

  const standard = pickCurrentStandard(standards);
  if (!standard) {
    return { ...empty, unresolved: ["sin tarifa estándar"] };
  }

  const othcRate = localTipo === "Reefer" ? standard.othcReefer : standard.othcDry;
  const gateOutRate =
    localTipo === "Reefer" ? standard.gateOutReefer : standard.gateOutDry;
  const gateOut = carrierGetsStandardGateOut(carrier) ? gateOutRate * ctrs : 0;
  const othc = othcRate * ctrs;
  const sello = standard.sello * ctrs;
  const ams = standard.ams * bls;
  const blFee = standard.blFee * bls;

  return {
    matchedException: undefined,
    appliedStandard: standard,
    othc,
    sello,
    ams,
    blFee,
    gateOut,
    otherCharges: 0,
    total: othc + sello + ams + blFee + gateOut,
    conditional: [],
    unresolved: [],
  };
}

// ===== ARG clients (origin Mendoza) =====
//
// Argentinean shippers that pick up the Mendoza thermal/haulage variants in
// invoicing instead of Chile. Stored as a simple list with optional comma-
// separated alternative names so a single client (e.g., Grupo Peñaflor) can
// match multiple shipper labels on incoming BLs.
export type ArgClientTipo = "Bodega" | "Mostero";

export type ArgClient = {
  id: string;
  name: string;
  tipo: ArgClientTipo;
  // Comma- or semicolon-separated alternative names / brands.
  alternativeNames: string;
  notes: string;
};

export const SEED_ARG_CLIENTS: ArgClient[] = [
  // ===== Bodegas =====
  { id: "seed-arg-bodegas-fabre", tipo: "Bodega", name: "Bodegas Fabre", alternativeNames: "", notes: "" },
  { id: "seed-arg-grupo-penaflor", tipo: "Bodega", name: "Grupo Peñaflor", alternativeNames: "Trapiche, Finca Las Moras, Navarro Correas, Andean Vineyards", notes: "" },
  { id: "seed-arg-goyenechea", tipo: "Bodega", name: "Goyenechea", alternativeNames: "", notes: "" },
  { id: "seed-arg-mipster", tipo: "Bodega", name: "Mipster", alternativeNames: "", notes: "" },
  { id: "seed-arg-vina-montpellier", tipo: "Bodega", name: "Viña Montpellier", alternativeNames: "", notes: "" },
  { id: "seed-arg-catena-zapata", tipo: "Bodega", name: "Catena Zapata", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-norton", tipo: "Bodega", name: "Bodega Norton", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-trapiche", tipo: "Bodega", name: "Bodega Trapiche", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-rutini", tipo: "Bodega", name: "Bodega Rutini", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-salentein", tipo: "Bodega", name: "Bodega Salentein", alternativeNames: "", notes: "" },
  { id: "seed-arg-luigi-bosca", tipo: "Bodega", name: "Luigi Bosca", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-chandon", tipo: "Bodega", name: "Bodega Chandón", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-lagarde", tipo: "Bodega", name: "Bodega Lagarde", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-la-rural", tipo: "Bodega", name: "Bodega La Rural", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-santa-julia", tipo: "Bodega", name: "Bodega Santa Julia", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-bianchi", tipo: "Bodega", name: "Bodega Bianchi", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-nieto-senetiner", tipo: "Bodega", name: "Bodega Nieto Senetiner", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-septima", tipo: "Bodega", name: "Bodega Séptima", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-renacer", tipo: "Bodega", name: "Bodega Renacer", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-atamisque", tipo: "Bodega", name: "Bodega Atamisque", alternativeNames: "", notes: "" },
  { id: "seed-arg-casa-de-uco", tipo: "Bodega", name: "Casa de Uco", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-casarena", tipo: "Bodega", name: "Bodega Casarena", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-la-celia", tipo: "Bodega", name: "Bodega La Celia", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodegas-lopez", tipo: "Bodega", name: "Bodegas López", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-vistalba", tipo: "Bodega", name: "Bodega Vistalba", alternativeNames: "", notes: "" },
  { id: "seed-arg-durigutti", tipo: "Bodega", name: "Durigutti Family Winemakers", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-argento", tipo: "Bodega", name: "Bodega Argento", alternativeNames: "Grupo Avinea", notes: "" },
  { id: "seed-arg-cheval-des-andes", tipo: "Bodega", name: "Cheval des Andes", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-alta-vista", tipo: "Bodega", name: "Bodega Alta Vista", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-alfredo-roca", tipo: "Bodega", name: "Bodega Alfredo Roca", alternativeNames: "", notes: "" },
  { id: "seed-arg-altos-las-hormigas", tipo: "Bodega", name: "Altos Las Hormigas", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-bressia", tipo: "Bodega", name: "Bodega Bressia", alternativeNames: "Grappolo", notes: "" },
  { id: "seed-arg-vina-las-perdices", tipo: "Bodega", name: "Viña Las Perdices", alternativeNames: "", notes: "" },
  { id: "seed-arg-rosell-boher", tipo: "Bodega", name: "Rosell Boher", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-antucura", tipo: "Bodega", name: "Bodega Antucurá", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-amalaya", tipo: "Bodega", name: "Bodega Amalaya", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-aleanna", tipo: "Bodega", name: "Bodega Aleanna", alternativeNames: "", notes: "" },
  { id: "seed-arg-mosquita-muerta", tipo: "Bodega", name: "Mosquita Muerta Wines", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-monteviejo", tipo: "Bodega", name: "Bodega Monteviejo", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-el-esteco", tipo: "Bodega", name: "Bodega El Esteco", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-del-fin-del-mundo", tipo: "Bodega", name: "Bodega Del Fin del Mundo", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-colome", tipo: "Bodega", name: "Bodega Colomé", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-andeluna", tipo: "Bodega", name: "Bodega Andeluna", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-chakana", tipo: "Bodega", name: "Bodega Chakana", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodegas-esmeralda", tipo: "Bodega", name: "Bodegas Esmeralda", alternativeNames: "", notes: "" },
  { id: "seed-arg-trivento", tipo: "Bodega", name: "Trivento Bodegas y Viñedos", alternativeNames: "", notes: "" },
  { id: "seed-arg-clos-de-los-siete", tipo: "Bodega", name: "Clos de los Siete", alternativeNames: "", notes: "" },
  { id: "seed-arg-piattelli", tipo: "Bodega", name: "Piattelli Vineyards", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-dante-robino", tipo: "Bodega", name: "Bodega Dante Robino", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-tittarelli", tipo: "Bodega", name: "Bodega Tittarelli", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodegas-augusto-pulenta", tipo: "Bodega", name: "Bodegas Augusto Pulenta", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodegas-hugo-eduardo-pulenta", tipo: "Bodega", name: "Bodegas Hugo y Eduardo Pulenta", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodegas-crotta", tipo: "Bodega", name: "Bodegas Crotta", alternativeNames: "", notes: "" },
  { id: "seed-arg-pascual-toso", tipo: "Bodega", name: "Pascual Toso", alternativeNames: "", notes: "" },
  { id: "seed-arg-cuarta-generacion", tipo: "Bodega", name: "Cuarta Generación", alternativeNames: "Cabrini", notes: "" },
  { id: "seed-arg-dominio-del-plata", tipo: "Bodega", name: "Dominio del Plata", alternativeNames: "Susana Balbo", notes: "" },
  { id: "seed-arg-humberto-canale", tipo: "Bodega", name: "Establecimiento Humberto Canale", alternativeNames: "", notes: "" },
  { id: "seed-arg-finca-agostino", tipo: "Bodega", name: "Finca Agostino", alternativeNames: "", notes: "" },
  { id: "seed-arg-finca-flichman", tipo: "Bodega", name: "Finca Flichman", alternativeNames: "", notes: "" },
  { id: "seed-arg-finca-la-celia", tipo: "Bodega", name: "Finca La Celia", alternativeNames: "", notes: "" },
  { id: "seed-arg-la-riojana", tipo: "Bodega", name: "La Riojana Cooperativa", alternativeNames: "", notes: "" },
  { id: "seed-arg-leoncio-arizu", tipo: "Bodega", name: "Leoncio Arizu", alternativeNames: "", notes: "" },
  { id: "seed-arg-los-haroldos", tipo: "Bodega", name: "Los Haroldos", alternativeNames: "", notes: "" },
  { id: "seed-arg-pernod-ricard", tipo: "Bodega", name: "Pernod Ricard Argentina", alternativeNames: "", notes: "" },
  { id: "seed-arg-fincas-patagonicas", tipo: "Bodega", name: "Fincas Patagónicas", alternativeNames: "Bodega Tapiz", notes: "" },
  { id: "seed-arg-dona-paula", tipo: "Bodega", name: "Doña Paula", alternativeNames: "", notes: "" },
  { id: "seed-arg-escorihuela", tipo: "Bodega", name: "Establecimiento Vitivinícola Escorihuela", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-malma", tipo: "Bodega", name: "Bodega Malma", alternativeNames: "Viñedos de la Patagonia", notes: "" },
  { id: "seed-arg-huarpe", tipo: "Bodega", name: "Bodegas y Viñedos Huarpe", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-chanarmuyo", tipo: "Bodega", name: "Bodega Chañarmuyo", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-pie-de-palo", tipo: "Bodega", name: "Bodega Pie de Palo", alternativeNames: "Bórbore", notes: "" },
  { id: "seed-arg-casa-montes", tipo: "Bodega", name: "Casa Montes", alternativeNames: "", notes: "" },
  { id: "seed-arg-dolium", tipo: "Bodega", name: "Dolium", alternativeNames: "", notes: "" },
  { id: "seed-arg-kaiken", tipo: "Bodega", name: "Kaiken", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-antigal", tipo: "Bodega", name: "Bodega Antigal", alternativeNames: "", notes: "" },
  { id: "seed-arg-bodega-tacuil", tipo: "Bodega", name: "Bodega Tacuil", alternativeNames: "", notes: "" },
  { id: "seed-arg-matervini", tipo: "Bodega", name: "Matervini", alternativeNames: "", notes: "" },
  { id: "seed-arg-sophenia", tipo: "Bodega", name: "Sophenia", alternativeNames: "", notes: "" },
  { id: "seed-arg-don-rosendo", tipo: "Bodega", name: "Don Rosendo Wines", alternativeNames: "", notes: "" },
  { id: "seed-arg-carmelo-patti", tipo: "Bodega", name: "Carmelo Patti", alternativeNames: "", notes: "" },
  { id: "seed-arg-la-guarda", tipo: "Bodega", name: "La Guarda", alternativeNames: "", notes: "" },
  { id: "seed-arg-bournett", tipo: "Bodega", name: "Bournett", alternativeNames: "", notes: "" },
  { id: "seed-arg-carelli", tipo: "Bodega", name: "Carelli", alternativeNames: "", notes: "" },
  { id: "seed-arg-budeguer", tipo: "Bodega", name: "Budeguer", alternativeNames: "", notes: "" },
  { id: "seed-arg-vinos-del-potrero", tipo: "Bodega", name: "Vinos del Potrero", alternativeNames: "", notes: "" },
  { id: "seed-arg-xumek", tipo: "Bodega", name: "Xumek", alternativeNames: "", notes: "" },
  { id: "seed-arg-cassone", tipo: "Bodega", name: "Cassone", alternativeNames: "Obra Prima, La Florencia", notes: "" },
  { id: "seed-arg-finca-bandini", tipo: "Bodega", name: "Finca Bandini", alternativeNames: "", notes: "" },
  { id: "seed-arg-terrazas-de-los-andes", tipo: "Bodega", name: "Terrazas de los Andes", alternativeNames: "", notes: "" },
  { id: "seed-arg-finca-victoria", tipo: "Bodega", name: "Finca Victoria", alternativeNames: "", notes: "" },
  { id: "seed-arg-familia-zuccardi", tipo: "Bodega", name: "Familia Zuccardi", alternativeNames: "", notes: "" },
  { id: "seed-arg-dervinsa", tipo: "Bodega", name: "Derivados Vínicos", alternativeNames: "Dervinsa", notes: "" },

  // ===== Mosteros =====
  { id: "seed-arg-mostera-rio-mendoza", tipo: "Mostero", name: "Mostera Río Mendoza", alternativeNames: "", notes: "" },
  { id: "seed-arg-fecovita", tipo: "Mostero", name: "Fecovita", alternativeNames: "", notes: "" },
  { id: "seed-arg-mosto-argentino", tipo: "Mostero", name: "Mosto Argentino", alternativeNames: "", notes: "" },
  { id: "seed-arg-cooperativa-vitivinicola-arg", tipo: "Mostero", name: "Cooperativa Vitivinícola de Argentina", alternativeNames: "", notes: "" },
];

// Common Spanish wine-industry words and articles. Stripped before comparing
// names so "Bodega Catena Zapata" and "Catena Zapata" collapse to the same
// canonical form. Adding more words is cheap; over-stripping is the risk
// (e.g., a real brand "La Rural" could collapse to "rural").
const ARG_NAME_STOPWORDS = new Set([
  "bodega",
  "bodegas",
  "grupo",
  "finca",
  "fincas",
  "vina",
  "viña",
  "vinos",
  "casa",
  "establecimiento",
  "vitivinicola",
  "vitivinícola",
  "vinedos",
  "viñedos",
  "y",
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "wines",
  "cooperativa",
  "cooperative",
  "cia",
  "compania",
  "compañia",
  "compañía",
  "familia",
  "family",
  "winemakers",
]);

function normalizeNameText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    // U+0300 - U+036F is the Combining Diacritical Marks block. Stripping
    // it after NFD turns "peñaflor" / "Cony Toro" / etc. into ASCII-ish.
    .replace(/[̀-ͯ]/g, "");
}

function tokenizeName(s: string): string[] {
  return normalizeNameText(s)
    .split(/[\s\-,.;()]+/)
    .filter((t) => t && !ARG_NAME_STOPWORDS.has(t));
}

function canonicalizeName(s: string): string {
  return tokenizeName(s).join(" ");
}

// Iterative DP Levenshtein. Acceptable for tens of clients × short names.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      curr.push(
        Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost)
      );
    }
    prev = curr;
  }
  return prev[b.length]!;
}

// Similarity in [0, 1] over canonical (stopword-stripped) names. 1 means
// identical or one is a substring of the other; otherwise normalized
// Levenshtein distance.
export function argClientNameSimilarity(a: string, b: string): number {
  const ca = canonicalizeName(a);
  const cb = canonicalizeName(b);
  if (!ca || !cb) return 0;
  if (ca === cb) return 1;
  // Substring match after stripping common prefixes catches "Catena Zapata"
  // ⊂ "Bodega Catena Zapata" and "Peñaflor" ⊂ "Grupo Peñaflor".
  if (ca.includes(cb) || cb.includes(ca)) return 0.9;
  const dist = levenshtein(ca, cb);
  return 1 - dist / Math.max(ca.length, cb.length);
}

const ARG_NAME_SIMILARITY_THRESHOLD = 0.75;

// Classifies a candidate name against an existing ARG client list:
//   - exactMatch:   case-insensitive trim equality against the client's name
//                   OR any of its alternativeNames. Caller should DISCARD.
//   - similarMatches: clients with similarity >= 0.75 against the canonical
//                   form of name or any alternative. Caller should ASK the
//                   user (default action: merge as alternative).
// When exactMatch is set, similarMatches is empty — exact wins.
export function findSimilarClient(
  name: string,
  clients: ArgClient[]
): { exactMatch: ArgClient | null; similarMatches: ArgClient[] } {
  const candidate = name.trim().toLowerCase();
  if (!candidate) return { exactMatch: null, similarMatches: [] };
  for (const client of clients) {
    if (client.name.trim().toLowerCase() === candidate) {
      return { exactMatch: client, similarMatches: [] };
    }
    const alts = client.alternativeNames
      .split(/[,;]/)
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean);
    if (alts.includes(candidate)) {
      return { exactMatch: client, similarMatches: [] };
    }
  }
  const similar: ArgClient[] = [];
  for (const client of clients) {
    const candidates = [
      client.name,
      ...client.alternativeNames
        .split(/[,;]/)
        .map((a) => a.trim())
        .filter(Boolean),
    ];
    let maxSim = 0;
    for (const c of candidates) {
      const s = argClientNameSimilarity(name, c);
      if (s > maxSim) maxSim = s;
    }
    if (maxSim >= ARG_NAME_SIMILARITY_THRESHOLD) similar.push(client);
  }
  return { exactMatch: null, similarMatches: similar };
}

// True when the given text (POL, route, etc.) names an Argentinian / Mendoza
// origin. Used during rate ingest to decide which thermal/haulage column
// gets the resolved values.
const ARG_ORIGIN_KEYWORDS = ["mendoza", "mza", "argentina", "buenos aires"];

export function isArgentinianOrigin(s: string): boolean {
  if (!s) return false;
  const norm = s.toLowerCase();
  return ARG_ORIGIN_KEYWORDS.some((k) => norm.includes(k));
}

// True when the BL's shipper text matches any ARG client. Match is bidirectional
// (the shipper contains the client name OR the client name contains the
// shipper) and case-insensitive — covers both "Trapiche" coming in shorter
// than the canonical brand and longer brand-line variants.
export function isArgShipper(
  shipper: string,
  argClients: ArgClient[]
): boolean {
  const s = shipper.trim().toLowerCase();
  if (!s) return false;
  for (const client of argClients) {
    const candidates = [
      client.name,
      ...client.alternativeNames.split(/[,;]/).map((b) => b.trim()),
    ]
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    for (const c of candidates) {
      if (c.includes(s) || s.includes(c)) return true;
    }
  }
  return false;
}
