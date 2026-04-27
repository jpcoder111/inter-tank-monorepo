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
  tipo: string;
  sf: number;
  blFee: number;
  af: number;
  afMax: number;
  flexiArg: number;
  validFrom: string;
  validTo: string;
  notes: string;
};

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
