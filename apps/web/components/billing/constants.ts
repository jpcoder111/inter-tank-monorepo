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
  "Chile - Mediterráneo",
  "Chile - Asia",
  "Chile - Sudamérica",
  "Chile - Norteamérica",
  "Chile - Centroamérica",
  "Chile - África",
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

export type Ebs = {
  id: string;
  carrier: string;
  traffic: string;
  amountPerTEU: number;
  validFrom: string;
  validTo: string;
  notes: string;
};

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
    amountPerTEU: 126,
    validFrom: "2026-04-01",
    validTo: "2026-06-30",
    notes: "Cubre Rotterdam, Hamburg, Antwerp, London, Copenhagen, Klaipeda, etc.",
  },
  {
    id: "seed-ebs-hapag-cl-neu",
    carrier: "HAPAG",
    traffic: "Chile - Norte de Europa",
    amountPerTEU: 160,
    validFrom: "2026-04-01",
    validTo: "2026-06-30",
    notes: "Cubre Grangemouth, Rotterdam, Hamburg, etc.",
  },
  {
    id: "seed-ebs-cma-cl-neu",
    carrier: "CMA-CGM",
    traffic: "Chile - Norte de Europa",
    amountPerTEU: 160,
    validFrom: "2026-04-01",
    validTo: "2026-06-30",
    notes: "Incluido en all-in HCL",
  },
];

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
