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
export const EBS_STORAGE_KEY = "it_ebs_v3";

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
    notes: "",
  },
  {
    id: "seed-ebs-hapag-cl-grm",
    carrier: "HAPAG",
    traffic: "Chile - Grangemouth",
    amountPerTEU: 160,
    validFrom: "2026-04-01",
    validTo: "2026-06-30",
    notes: "",
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
