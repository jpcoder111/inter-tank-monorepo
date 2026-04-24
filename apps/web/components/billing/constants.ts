export const AGENTS = ["IWS", "Van Moer", "Asstra", "HCL", "Scan", "CCL", "BULLET"] as const;
export type Agent = (typeof AGENTS)[number];

export const CARRIERS = [
  "OOCL",
  "HAPAG",
  "CMA-CGM",
  "PIL",
  "COSCO",
  "Evergreen",
  "MSC",
] as const;
export type Carrier = (typeof CARRIERS)[number];

export const CONTAINER_TYPES = [
  "20'",
  "Flexi",
  "40'",
  "40'HC",
  "20'RF",
  "40'RF",
] as const;
export type ContainerType = (typeof CONTAINER_TYPES)[number];

export const AGENT_COLORS: Record<Agent, string> = {
  IWS: "#d9ead3",
  "Van Moer": "#cfe2f3",
  Asstra: "#d9d2e9",
  HCL: "#fce5cd",
  Scan: "#d0e0e3",
  CCL: "#eaf2fb",
  BULLET: "#f5eef8",
};

export const RATES_STORAGE_KEY = "it_rates";
export const EBS_STORAGE_KEY = "it_ebs";

export type Rate = {
  id: string;
  agent: Agent;
  carrier: Carrier;
  route: string;
  tipo: ContainerType;
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
  carrier: Carrier;
  traffic: string;
  tipo: ContainerType;
  amountPerTEU: number;
  validFrom: string;
  validTo: string;
  notes: string;
};

export const SEED_RATES: Rate[] = [
  {
    id: "seed-iws-1",
    agent: "IWS",
    carrier: "OOCL",
    route: "BUE-SHA",
    tipo: "20'",
    sf: 1200,
    blFee: 75,
    af: 150,
    afMax: 300,
    flexiArg: 450,
    validFrom: "2026-01-01",
    validTo: "2026-06-30",
    notes: "",
  },
  {
    id: "seed-vanmoer-1",
    agent: "Van Moer",
    carrier: "HAPAG",
    route: "BUE-HAM",
    tipo: "40'",
    sf: 1800,
    blFee: 90,
    af: 200,
    afMax: 400,
    flexiArg: 0,
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    notes: "",
  },
  {
    id: "seed-asstra-1",
    agent: "Asstra",
    carrier: "MSC",
    route: "BUE-RTM",
    tipo: "Flexi",
    sf: 1500,
    blFee: 80,
    af: 180,
    afMax: 350,
    flexiArg: 500,
    validFrom: "2026-02-01",
    validTo: "2026-05-15",
    notes: "Confirmar con Madrid",
  },
];

export const SEED_EBS: Ebs[] = [
  {
    id: "seed-ebs-1",
    carrier: "OOCL",
    traffic: "ASIA",
    tipo: "20'",
    amountPerTEU: 120,
    validFrom: "2026-01-01",
    validTo: "2026-06-30",
    notes: "",
  },
  {
    id: "seed-ebs-2",
    carrier: "HAPAG",
    traffic: "EUROPA",
    tipo: "40'",
    amountPerTEU: 180,
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    notes: "",
  },
  {
    id: "seed-ebs-3",
    carrier: "MSC",
    traffic: "EUROPA",
    tipo: "Flexi",
    amountPerTEU: 150,
    validFrom: "2026-02-01",
    validTo: "2026-05-15",
    notes: "",
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
