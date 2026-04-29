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
  "Hapag",
  "CMA-CGM",
  "MSC",
  "Evergreen",
  "COSCO",
  "ONE",
  "Maersk",
  "ZIM",
  "HMM",
  "Yang Ming",
  "PIL",
  "Wan Hai",
] as const;

// Canonical container-type literals used by the v3 schema. Each rate row
// encodes ONE size + ONE category. Free-form strings produced by extraction or
// loaded from older localStorage records are normalized via migrateContainerType.
export const CONTAINER_TYPES = [
  "20'Dry",
  "40'Dry",
  "40'Reefer",
  "20'Flexi",
] as const;

export type ContainerType = (typeof CONTAINER_TYPES)[number];

export const CONTAINER_TYPE_SUGGESTIONS = CONTAINER_TYPES;

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
// EbsTab y como chip/cell highlight en RatesTab + Step 2 de NewRateFlow.
// Reglas: tonos pastel salvo Maersk (celeste fuerte, única excepción —
// pedido del usuario para que destaque). Prohibidos: rojo (reservado a
// blocking errors), amarillo (warnings), verde saturado (vigente). Cada
// color tiene que ser visualmente distinguible de los demás — la
// confusión histórica entre Evergreen y OOCL la causaba un default
// genérico que ya no existe.
export const CARRIER_COLORS: Record<string, string> = {
  OOCL: "#e8eaed",        // gris claro
  Hapag: "#fff0e0",       // naranja melón claro
  "CMA-CGM": "#e8f0fe",   // celeste pálido
  MSC: "#f5f0e8",         // beige crema
  Evergreen: "#e0f2e0",   // verde menta claro
  ONE: "#fce4ec",         // rosa claro
  PIL: "#ede1f5",         // lila / violeta claro (era rojizo, cambia)
  "Yang Ming": "#e2d4b8", // beige tostado / camel — distinto al verde menta de Evergreen
  Maersk: "#93c5fd",      // celeste FUERTE — única excepción a "pasteles"
  COSCO: "#fde2cf",       // durazno claro
  ZIM: "#ddd5e8",         // lavanda gris
  HMM: "#d6e4f0",         // azul-gris claro
  "Wan Hai": "#d3f0e9",   // mint aqua
};

export const CARRIER_COLOR_FALLBACK = "#f3f4f6";

// Maps emails-of-the-wild diminutives ("EVER", "CMA", "YML") to the
// canonical key in CARRIER_COLORS / CARRIER_SUGGESTIONS. The map is
// consulted ONLY by carrierColor + carriersMatch — saved Rate.carrier
// values are NEVER rewritten, so a rate that arrived with carrier="EVER"
// keeps "EVER" on disk while still rendering with the Evergreen colour.
//
// Lookup is case-insensitive and ignores spaces/hyphens (see
// resolveCarrierAlias below). Add new aliases here as the catalog of
// agent dialects grows; do not duplicate keys that are already canonical
// in CARRIER_COLORS.
export const CARRIER_ALIASES: Record<string, string> = {
  // CMA-CGM
  cma: "CMA-CGM",
  cmacgm: "CMA-CGM",
  // Evergreen
  ever: "Evergreen",
  eg: "Evergreen",
  evergreen: "Evergreen",
  // Yang Ming (catalog key is "Yang Ming")
  yangming: "Yang Ming",
  yml: "Yang Ming",
  ym: "Yang Ming",
  // HMM (catalog key is "HMM")
  hyundai: "HMM",
  hyundaimerchantmarine: "HMM",
  // Hapag-Lloyd (catalog key is "Hapag")
  "hapag lloyd": "Hapag",
  "hapag-lloyd": "Hapag",
  hapaglloyd: "Hapag",
  hlag: "Hapag",
};

function carrierKey(c: string): string {
  return c.toLowerCase().replace(/[\s-]+/g, "").trim();
}

// Resolves a free-form carrier string to its canonical CARRIER_COLORS key.
// Returns the original string when no alias / direct hit applies — callers
// then decide whether to fall back (e.g. carrierColor → neutral grey).
export function resolveCarrierCanonical(carrier: string): string {
  if (!carrier) return carrier;
  if (CARRIER_COLORS[carrier]) return carrier;
  const key = carrierKey(carrier);
  // Direct alias hit (case/space/dash-insensitive).
  for (const aliasKey of Object.keys(CARRIER_ALIASES)) {
    if (carrierKey(aliasKey) === key) return CARRIER_ALIASES[aliasKey]!;
  }
  // Case-insensitive direct hit on a canonical name.
  for (const canonical of Object.keys(CARRIER_COLORS)) {
    if (carrierKey(canonical) === key) return canonical;
  }
  return carrier;
}

// Resolves a carrier name to its brand color, tolerant of dash/space variants
// ("CMA-CGM" vs "CMA CGM" vs "cma cgm") AND of common diminutives ("EVER" →
// Evergreen, "YML" → Yang Ming). Returns the neutral fallback for unknown
// carriers.
export function carrierColor(carrier: string): string {
  if (!carrier) return CARRIER_COLOR_FALLBACK;
  const direct = CARRIER_COLORS[carrier];
  if (direct) return direct;
  const canonical = resolveCarrierCanonical(carrier);
  const viaAlias = CARRIER_COLORS[canonical];
  if (viaAlias) return viaAlias;
  for (const key of Object.keys(CARRIER_COLORS)) {
    if (carriersMatch(key, carrier)) return CARRIER_COLORS[key]!;
  }
  return CARRIER_COLOR_FALLBACK;
}

// Storage keys are version-suffixed: bump when the schema or seed changes so
// existing localStorage data is replaced with the new seeds on next load.
// v3 introduces dynamic kinds with scope. Migration from v2 (834ad41
// additionalCosts) and older legacy fields runs once at module init via
// ensureRateMigration below — see RATE_MIGRATION_FLAG / RATES_STORAGE_KEY_V2.
export const RATES_STORAGE_KEY = "it_rates_v3";
export const RATES_STORAGE_KEY_V2 = "it_rates_v2";
export const RATES_STORAGE_KEY_V2_BACKUP = "it_rates_v2_backup_pre_v3";
export const RATE_MIGRATION_FLAG = "rate_schema_v3_migrated";
// v3.2 — adds Rate.incoterm. Backup the v3 blob before stamping each rate
// with a derived incoterm (default "FOB/CIF/CFR" when no signal exists).
// Idempotent: runs once per browser, controlled by the flag.
export const RATE_MIGRATION_FLAG_V32 = "rate_schema_v3_2_incoterm_migrated";
export const RATES_STORAGE_KEY_V32_BACKUP = "it_rates_v3_backup_pre_v32";
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

// Where in the BL row does an extra cost apply.
//   "all"    → every container, no filter
//   "20"     → only 20' containers
//   "40"     → only 40' (incl. HC, RF) containers
//   "dry"    → only dry-cargo containers (excludes RF)
//   "reefer" → only reefer (RF) containers
export type AppliesTo = "all" | "20" | "40" | "dry" | "reefer";

// Canonical cost categories — invoicing matches by `kind` to decide
// shipper-based variants (e.g., thermal_chile vs thermal_mendoza). "other"
// keeps the door open for free-form labels with no built-in semantics.
export type AdditionalCostKind =
  | "thermal_chile"
  | "thermal_mendoza"
  | "fca_haulage_mendoza"
  | "flexitank_chile"
  | "flexitank_argentina"
  | "agency_fee"
  | "agency_fee_max"
  | "discount_insulated"
  | "other";

export type AdditionalCost = {
  // Stable per-row id so the form can edit/remove individual entries.
  id: string;
  kind: AdditionalCostKind;
  label: string;
  value: number;
  applies: AppliesTo;
};

// ===== v3 schema (kinds with scope) =====
//
// Replaces the fixed-shape thermal/haulage/agency fields with a dynamic list of
// "kinds" — each kind is a category of charge (Insulado Chile, Precarriage
// Mendoza, Agency Fee, etc.) that may or may not vary by container size.
// `kind_values` holds the actual numbers per rate; `kinds` (denormalized into
// the rate so it stays self-contained outside a batch) holds the definitions.
//
// Scope decides which container types pick up the charge at invoicing time:
//   "dry"    → applies only to dry cargo (excludes Reefer)
//   "reefer" → applies only to refrigerated cargo
//   "all"    → applies to anything
export type KindScope = "dry" | "reefer" | "all";

export type KindDef = {
  id: string;
  label: string;
  scope: KindScope;
  // true  → the kind's value differs between 20' and 40' (uses value20/value40)
  // false → a single value_unique applies regardless of size
  by_size: boolean;
  // false for user-created custom kinds; true for the hardcoded catalog below.
  predefined: boolean;
  // Optional per-rate restriction. When defined, the kind applies ONLY to
  // rates whose id is listed here. When undefined, the kind applies to every
  // rate of the batch (modulo the existing dry/reefer/all scope filter).
  // Populated by the Fix 1 sweep that detects "Doesn't include Disposal
  // USD 190" phrases sitting on specific Excel rows (KATAOKA fixture):
  // those rates carry the kind, the rest do not. Legacy rates that lack
  // the field continue to behave as scope-all.
  affected_rate_ids?: string[];
};

export type KindValue = {
  kind_id: string;
  value20?: number;
  value40?: number;
  value_unique?: number;
};

// Hardcoded catalog of 9 kinds. Custom kinds the user adds at extraction time
// live ONLY on the resulting rate(s) — we don't persist them back into this
// catalog. Default-value hints in the fixture are not enforced; the parser
// emits whatever the source document says.
export const PREDEFINED_KINDS: KindDef[] = [
  { id: "flexitank_chile", label: "Flexitank Chile", scope: "dry", by_size: false, predefined: true },
  { id: "flexitank_arg", label: "Flexitank Argentina", scope: "dry", by_size: false, predefined: true },
  { id: "insulado_chile", label: "Insulado Chile", scope: "dry", by_size: true, predefined: true },
  { id: "insulado_arg", label: "Insulado Argentina", scope: "dry", by_size: true, predefined: true },
  { id: "precarriage_mendoza", label: "Precarriage Mendoza", scope: "all", by_size: true, predefined: true },
  { id: "disposal", label: "Disposal", scope: "all", by_size: false, predefined: true },
  { id: "agency_fee", label: "Agency Fee", scope: "all", by_size: false, predefined: true },
  { id: "agency_fee_max", label: "Agency Fee Max", scope: "all", by_size: false, predefined: true },
  { id: "discount_insulated", label: "Descuento Insulado", scope: "dry", by_size: false, predefined: true },
];

// Aliases the parser uses to canonicalize labels coming out of Excel headers
// or email lines. Both literal strings and regex are accepted; matching is
// case-insensitive and ignores punctuation / common suffixes (see normalizeKindLabel).
export const KIND_ALIASES: Record<string, ReadonlyArray<string | RegExp>> = {
  insulado_chile: [
    "thermal liner s&f chile",
    "thermal liner chile",
    "thermoliner chile",
    "thermo liner chile",
    "liner térmico chile",
    "insulado chile",
    // Unsized "Thermal Liner" / "Thermoliner" with no Chile/ARG qualifier
    // defaults to insulado_chile (~80% of catalog's flexi cargo originates
    // Chile). User can re-route to insulado_arg manually if the email
    // context demands it.
    /^thermal\s*liner$/i,
    /^thermo\s*liner$/i,
    /^thermoliner$/i,
  ],
  insulado_arg: [
    "thermal liner s&f mendoza",
    "thermal liner s&f argentina",
    "thermal liner mendoza",
    "thermal liner argentina",
    "thermoliner mendoza",
    "thermo liner mendoza",
    "liner térmico arg",
    "liner térmico argentina",
    "insulado argentina",
    "insulado arg",
    "insulado mendoza",
  ],
  flexitank_chile: [
    "flexitank chile",
    "flexi chile",
    "flexitank s&f chile",
    "s&f chile",
    "stuffing chile",
  ],
  flexitank_arg: [
    "flexitank argentina",
    "flexitank arg",
    "flexi argentina",
    "flexi arg",
    "flexitank s&f argentina",
    "s&f arg",
    "s&f argentina",
    "laf",
    "laf mendoza",
    "flexibag",
    "flexibag laf",
    "flexibag laf mendoza",
    "flexibag mendoza",
  ],
  precarriage_mendoza: [
    "fca haulage mendoza to chile base port",
    "fca haulage mendoza to chile",
    "haulage mendoza to chile base port",
    "haulage mendoza to chile",
    "fca haulage mendoza",
    "haulage mendoza",
    "fca mendoza",
    "precarriage mendoza",
    "inland mendoza",
    "inland fca mendoza",
    "inland rate for fca mendoza",
    "tarifa fca mendoza",
    /inland\s+for\s+\d+\s+fca\s+mendoza/i,
    // Catalog sheets sometimes split the same charge across rows by size,
    // emitting labels like "Precarriage 20'Flexi Mendoza" or "FCA 40'DC
    // Mendoza". These regex catch the size-tagged variants so all rows
    // collapse to one kind id.
    /^precarriage\s+\S+\s+mendoza\b/i,
    /^fca\s+\S+\s+mendoza\b/i,
  ],
  disposal: ["disposal", "disposal flexibag", "cargo disposal"],
  agency_fee: ["agency fee", "agentfee", "agencia", /agentfee\s+usd\s+\d+/i],
  agency_fee_max: [
    "agency fee max",
    "agentfee max",
    "tope agencia",
    /max\s+usd\s+[\d.]+\s+x\s+bl/i,
  ],
  discount_insulated: [
    "descuento insulado",
    /discount\s+(of\s+)?usd\s+[\d.]+\s+if\s+insulated/i,
  ],
};

// ===== Incoterm and POL/POD geography =====
//
// The Inter-Tank workflow needs the Incoterm explicitly because invoicing
// resolves "what's included in SF" (inland trucking vs port-to-port) by
// the Incoterm of the rate. The literal taxonomy is the small ICC set —
// FCA / EXW / FOB / CIF / CFR — plus a sentinel "FOB/CIF/CFR" used when
// the source didn't disclose which of the three applies; the placeholder
// is resolved at billing time against the customer's quote sheet.
export type Incoterm = "FCA" | "EXW" | "FOB" | "CIF" | "CFR" | "FOB/CIF/CFR";

// Order matters: the dropdown surfaces "FOB/CIF/CFR" first because it's
// the default for ambiguous rates and the most frequent picked value.
export const INCOTERM_OPTIONS: readonly Incoterm[] = [
  "FOB/CIF/CFR",
  "FCA",
  "EXW",
  "FOB",
  "CIF",
  "CFR",
] as const;

// Argentine cities that appear as POL on FCA / EXW Inter-Tank rates.
// Inter-Tank's Mendoza-region trucking covers these. When a rate's POL
// matches one of these (case-insensitive substring), the Incoterm
// inference falls to "FCA" by default. Extend manually as new pickup
// points appear in the field — match is intentionally case-insensitive
// substring, so prefixed strings like "FCA Mendoza" or "EXW Santa Rita"
// also match.
export const ARG_POL_CITIES: readonly string[] = [
  "mendoza",
  "san carlos",
  "tupungato",
  "rivadavia",
  "san juan",
  "san martin",
  "san martín",
  "santa rita",
  "rio negro",
  "río negro",
] as const;

// True when a POL string contains any Argentine pickup city. Used by
// the Incoterm inference + the FCA-pod-inheritance pipeline.
export function isArgPol(pol: string): boolean {
  if (!pol) return false;
  const norm = pol.trim().toLowerCase();
  return ARG_POL_CITIES.some((city) => norm.includes(city));
}

// Argentine cities that appear as the origin of inland precarriage charges
// ("Inland FCA Mendoza", "FCA Haulage San Martín to Chile"). Used by the
// detectPrecarriageInline sweep to decide whether a captured city becomes
// a predefined kind id (precarriage_mendoza when the city is Mendoza) or
// a custom precarriage_<slug>. Same set as ARG_POL_CITIES at present, kept
// separate so they can diverge later if precarriage geography expands
// past the FCA pickup catalog.
export const ARG_PRECARRIAGE_CITIES: readonly string[] = [
  "mendoza",
  "santa rita",
  "rivadavia",
  "san carlos",
  "san juan",
  "tupungato",
  "san martín",
  "san martin",
  "río negro",
  "rio negro",
] as const;

// Strips diacritics + lowercases for case- / accent-insensitive matching.
// The character class covers Unicode combining marks U+0300-U+036F so
// "Río", "São", and "Mendóza" all collapse to ASCII for set lookups.
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Matches a city string against ARG_PRECARRIAGE_CITIES. Returns the
// canonical (no-accent, lowercase, single-spaced) form when matched, null
// otherwise. Used by detectPrecarriageInline to decide kind id mapping.
export function matchArgPrecarriageCity(city: string): string | null {
  if (!city) return null;
  const n = norm(city).replace(/\s+/g, " ");
  for (const candidate of ARG_PRECARRIAGE_CITIES) {
    const cn = norm(candidate);
    if (n === cn) return cn;
  }
  return null;
}

// Result of a successful precarriage line capture. The line itself should
// be stripped from the text passed to the rate-extraction LLM so it never
// has a chance to be mis-classified as a maritime rate row.
export type PrecarriageHit = {
  rawLine: string;
  city: string; // canonical lowercased ascii (e.g. "mendoza", "san martin")
  cityDisplay: string; // original casing from the source ("Mendoza", "San Martín")
  size: 20 | 40 | null; // null when source omits the size qualifier
  value: number;
  kindId: string; // "precarriage_mendoza" or "custom_precarriage_<slug>"
  kindLabel: string; // "Precarriage Mendoza" or "Precarriage San Martín"
};

// Detects Inland / FCA Haulage / Haulage precarriage lines anywhere in the
// input text. Returns one hit per matching line. Caller is expected to
// strip the captured rawLine substrings from the text before passing it
// to the rate-extraction LLM so the line doesn't double-count.
//
// Pattern A (Inland):
//   "Inland FCA Mendoza 20 = USD 2250"
//   "Inland rate for 40 FCA Mendoza including local charges = USD 2270"
//   "Inland Mendoza = USD 2200"
//
// Pattern B (FCA Haulage / Haulage):
//   "FCA Haulage Mendoza to Chile = USD 2170"
//   "Haulage Mendoza to Chile base port = USD 2170"
//   "FCA Haulage San Martín to Chile = 2270"
//
// City lookup is accent- and case-insensitive against
// ARG_PRECARRIAGE_CITIES. Cities outside the catalog still emit a hit but
// land on a custom kind id (caller may surface a warning). Multi-word
// cities ("Santa Rita", "San Martín", "Río Negro") are supported.
export function detectPrecarriageInline(text: string): PrecarriageHit[] {
  if (!text) return [];
  const hits: PrecarriageHit[] = [];
  const lines = text.split(/\r?\n/);
  // Build the city alternation lazily on first call. Longer cities first
  // so the regex prefers "santa rita" over "rita".
  const cityAlt = ARG_PRECARRIAGE_CITIES.slice()
    .sort((a, b) => b.length - a.length)
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  // Pattern A — Inland (with optional "rate for", optional size, optional
  // FCA prefix on city). The size token can appear before OR after the
  // city: "Inland FCA Mendoza 20 = USD 2250" and "Inland rate for 40 FCA
  // Mendoza ... = USD 2270" both match.
  const inlandRe = new RegExp(
    String.raw`^\s*Inland\s+` +
      String.raw`(?:rate\s+(?:for\s+)?)?` +
      String.raw`(?:(?<sizeBefore>20|40)\s+)?` +
      String.raw`(?:FCA\s+)?` +
      String.raw`(?<city>${cityAlt})` +
      String.raw`(?:\s+(?<sizeAfter>20|40))?` +
      // Allow "including ...", "to <port>", "base port", "Mendoza Region",
      // any free-text tail before the "=" / ":" separator.
      String.raw`(?:\s+[^=:]*)?` +
      String.raw`\s*[=:]\s*(?:USD|US\$|\$)?\s*(?<value>[\d.,]+)`,
    "i"
  );
  // Pattern B — Haulage / FCA Haulage. "<city> to <dest>" with optional
  // "base port" suffix, value at the end. Size token rare in this form,
  // not parsed.
  const haulageRe = new RegExp(
    String.raw`^\s*(?:FCA\s+)?Haulage\s+` +
      String.raw`(?<city>${cityAlt})` +
      String.raw`\s+to\s+[A-Za-zñáéíóúÑÁÉÍÓÚ\s]+?` +
      String.raw`(?:\s+base\s+port)?` +
      String.raw`\s*[=:]\s*(?:USD|US\$|\$)?\s*(?<value>[\d.,]+)`,
    "i"
  );

  for (const line of lines) {
    if (!line.trim()) continue;
    const mA = line.match(inlandRe);
    if (mA && mA.groups) {
      const cityRaw = mA.groups.city ?? "";
      const sizeStr = mA.groups.sizeBefore ?? mA.groups.sizeAfter ?? "";
      const valStr = mA.groups.value ?? "";
      const value = parseAmount(valStr);
      if (value > 0 && cityRaw) {
        const canonical = matchArgPrecarriageCity(cityRaw);
        const cityKey = canonical ?? norm(cityRaw).replace(/\s+/g, "_");
        const display = cityRaw
          .trim()
          .replace(/\s+/g, " ")
          .replace(/(^|\s)\S/g, (s) => s.toUpperCase());
        hits.push({
          rawLine: line,
          city: cityKey,
          cityDisplay: display,
          size: sizeStr === "20" ? 20 : sizeStr === "40" ? 40 : null,
          value,
          kindId:
            cityKey === "mendoza"
              ? "precarriage_mendoza"
              : `custom_precarriage_${cityKey.replace(/\s+/g, "_")}`,
          kindLabel:
            cityKey === "mendoza"
              ? "Precarriage Mendoza"
              : `Precarriage ${display}`,
        });
        continue;
      }
    }
    const mB = line.match(haulageRe);
    if (mB && mB.groups) {
      const cityRaw = mB.groups.city ?? "";
      const valStr = mB.groups.value ?? "";
      const value = parseAmount(valStr);
      if (value > 0 && cityRaw) {
        const canonical = matchArgPrecarriageCity(cityRaw);
        const cityKey = canonical ?? norm(cityRaw).replace(/\s+/g, "_");
        const display = cityRaw
          .trim()
          .replace(/\s+/g, " ")
          .replace(/(^|\s)\S/g, (s) => s.toUpperCase());
        hits.push({
          rawLine: line,
          city: cityKey,
          cityDisplay: display,
          size: null, // Haulage form doesn't carry a size token
          value,
          kindId:
            cityKey === "mendoza"
              ? "precarriage_mendoza"
              : `custom_precarriage_${cityKey.replace(/\s+/g, "_")}`,
          kindLabel:
            cityKey === "mendoza"
              ? "Precarriage Mendoza"
              : `Precarriage ${display}`,
        });
      }
    }
  }
  return hits;
}

// Sub-client suffix capture. WENRAN-style lines look like:
//   "Thermal Liner S&F Chile (ASC - Aussino - EMW) = 180/280"
//   "Thermal Liner S&F Mendoza (ASC - Aussino - EMW) = 230/330"
// The base label is a predefined kind, but the parenthetical names
// specific sub-clients with a different value. Decision (per smoke-test
// prompt): the predefined kind keeps the GENERAL value (no parenthesis),
// the sub-client variant goes to batch.notes for the operator to apply
// at billing time. Lines whose base label is NOT a predefined kind fall
// through (caller treats them as custom kinds normally).
//
// Returns null when no sub-client suffix is detected. When detected,
// returns the consolidated note line ready for batch.notes:
//   "Cliente ASC-Aussino-EMW: Thermal Liner Chile 180/280"
export type SubClientSuffixHit = {
  rawLine: string;
  baseLabel: string;
  clients: string;
  values: string;
  noteLine: string;
};

export function extractSubClientSuffix(line: string): SubClientSuffixHit | null {
  const m = line.match(/^(.+?)\s*\(([^)]+)\)\s*=\s*(.+?)\s*$/);
  if (!m) return null;
  const baseLabel = (m[1] ?? "").trim();
  const suffix = (m[2] ?? "").trim();
  const valueStr = (m[3] ?? "").trim();
  if (!baseLabel || !suffix || !valueStr) return null;
  // Heuristic: a sub-client suffix typically has 2+ comma- or dash-separated
  // ALL-CAPS or capitalised tokens. A normal kind annotation like "(20'Flexi)"
  // has at most one short numeric/size token — skip those.
  const parts = suffix
    .split(/[-,/]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  // All parts must look like client codes (letters, digits, dots, hyphens,
  // ampersands, spaces). Reject when any part is purely a number or contains
  // a size qualifier like "20'" / "40DC" / "Reefer".
  const looksLikeClient = (p: string) =>
    /^[A-Za-z][A-Za-z0-9\s.&\-/]*$/.test(p) &&
    !/^(20|40)['’]?(?:dc|reefer|flexi|dry)?$/i.test(p) &&
    !/^(reefer|flexi|dry)$/i.test(p);
  if (!parts.every(looksLikeClient)) return null;
  // Only fire when the base label resolves to a predefined kind (matchKindByAlias).
  if (!matchKindByAlias(baseLabel)) return null;
  const clients = parts.join("-");
  return {
    rawLine: line,
    baseLabel,
    clients,
    values: valueStr,
    noteLine: `Cliente ${clients}: ${baseLabel} ${valueStr}`,
  };
}

// Sweeps the full text input for sub-client suffix lines and returns both
// the noteLines (caller appends them to batch.notes) and the rawLines
// (caller strips them from the text before sending to the LLM, same way
// detectPrecarriageInline operates).
export function detectSubClientSuffixes(text: string): {
  noteLines: string[];
  rawLines: string[];
} {
  if (!text) return { noteLines: [], rawLines: [] };
  const noteLines: string[] = [];
  const rawLines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const hit = extractSubClientSuffix(line);
    if (hit) {
      noteLines.push(hit.noteLine);
      rawLines.push(hit.rawLine);
    }
  }
  return { noteLines, rawLines };
}

// Adapts an Excel kinds-block (pipe-separated rows like
// "FCA Haulage Mendoza to Chile base port | 2170 | 2270") to the existing
// email-style detectors. The detectors require an "=" or ":" separator in
// the source line; the Excel pipeline never emits those — values land in
// distinct cells joined by " | ". This wrapper synthesizes per-column
// "Label = value" lines, runs the unmodified detectors against them, and
// rewrites hit.size based on column position so a two-value row produces
// value20 + value40 on a single kind.
//
// Accepts the kindsBlock string built by readExcelAsText (each row joined
// by " | ", sheets separated by "Hoja: <name>" prefixes). Returns the
// hits in the same shape used by NewRateFlow's text pipeline so the merge
// is a drop-in.
export function detectExcelBlockKinds(block: string): {
  precarriageHits: PrecarriageHit[];
  subClientNotes: string[];
  rawLinesToStrip: Set<string>;
} {
  const precarriageHits: PrecarriageHit[] = [];
  const subClientNotes: string[] = [];
  const rawLinesToStrip = new Set<string>();
  if (!block) return { precarriageHits, subClientNotes, rawLinesToStrip };

  const isNumericCell = (s: string): boolean =>
    /^[-+]?(?:USD|US\$|\$)?\s*[-+]?\s*[\d.,]+$/i.test(s);
  const stripUsd = (s: string): string =>
    s.replace(/^(?:USD|US\$|\$)\s*/i, "").trim();

  for (const original of block.split(/\r?\n/)) {
    const trimmed = original.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("Hoja:")) continue;

    const parts = trimmed.split(/\s*\|\s*/);

    // Single-segment rows: try the raw detectors directly. Covers the rare
    // case where an email-style "Label = value" line snuck into the right
    // block (LCL pages, free-text notes columns).
    if (parts.length < 2) {
      const directHits = detectPrecarriageInline(trimmed);
      if (directHits.length > 0) {
        for (const h of directHits) precarriageHits.push(h);
        rawLinesToStrip.add(trimmed);
        continue;
      }
      const subHit = extractSubClientSuffix(trimmed);
      if (subHit) {
        subClientNotes.push(subHit.noteLine);
        rawLinesToStrip.add(trimmed);
      }
      continue;
    }

    const label = (parts[0] ?? "").trim();
    if (!label) continue;
    const valueCells = parts.slice(1).map((p) => p.trim());
    // Skip header rows (e.g. "Item | 20 | 40") where no value cell parses
    // as a number.
    if (!valueCells.some(isNumericCell)) continue;

    // Sub-client suffix probe FIRST — extractSubClientSuffix only fires
    // when the base label resolves to a predefined alias AND the parens
    // hold 2+ client tokens, so non-suffix labels fall through quietly.
    const valuesJoined = valueCells.filter(Boolean).join("/");
    const subSyntheticLine = `${label} = ${valuesJoined}`;
    const subHit = extractSubClientSuffix(subSyntheticLine);
    if (subHit) {
      subClientNotes.push(subHit.noteLine);
      rawLinesToStrip.add(trimmed);
      continue;
    }

    // Precarriage probe — one synthetic per numeric cell, with hit.size
    // overridden from the cell's column index. Excel catalogs in our
    // corpus consistently lay 20' before 40' in adjacent columns, so
    // column-0 → 20' and column-1 → 40'.
    let anyHit = false;
    for (let i = 0; i < valueCells.length; i++) {
      const cell = valueCells[i] ?? "";
      if (!isNumericCell(cell)) continue;
      const numericPart = stripUsd(cell);
      const synthetic = `${label} = ${numericPart}`;
      const hits = detectPrecarriageInline(synthetic);
      for (const h of hits) {
        if (i === 0) h.size = 20;
        else if (i === 1) h.size = 40;
        // Three+ value columns are vanishingly rare in catalog blocks; if
        // they appear we leave size as null and let the merge prefer the
        // first unset slot.
        precarriageHits.push(h);
        anyHit = true;
      }
    }
    if (anyHit) rawLinesToStrip.add(trimmed);
  }

  return { precarriageHits, subClientNotes, rawLinesToStrip };
}

// Patterns whose presence on a line means "drop from batch.notes". The
// batch-notes textarea must contain ONLY operationally-billable info
// (free days, regional add-ons, sub-client values). Comments, narrative,
// EBS / validity / saludations / market context are noise and get
// filtered after the LLM run. Whitelist patterns short-circuit: a line
// matching one of those passes through even if a blacklist also matches
// (free-day lines often share keywords with narrative).
const BATCH_NOTES_WHITELIST: RegExp[] = [
  /\b\d+\s*(?:\/\s*\d+\s*)?\s*free\s+days?\b/i,
  /\bd[íi]as?\s+libres?\b/i,
  /\bcliente\s+[\wáéíóúñÁÉÍÓÚÑ\-\s]+:\s/i,
  /\borigen\s+alternativo\b/i,
  /\bafueras?\s+de\b/i,
  /\b(add|additional)\s+[A-Za-zñáéíóúÑÁÉÍÓÚ][\wáéíóúñÁÉÍÓÚÑ\s]+\s*(?:=\s*)?US\$?\s+\d/i,
  /\bsumar?\s+US\$?\s*\d/i,
];

const BATCH_NOTES_BLACKLIST: RegExp[] = [
  // Saludos / despedidas / aperturas de email
  /^\s*(hi|hello|hola|dear|estimad[oa]s?|saludos|cheers|best\s+regards|kind\s+regards|warm\s+regards|gracias|thanks?|regards|good\s+(morning|afternoon))\b/i,
  // Promesas / narrativa comercial
  /^\s*(we\s+(are|will|need|have)|sadly|happily|i('?m|\s+am)\s+happy|took\s+time|got\s+(partial\s+)?good\s+news)/i,
  /\b(varies\s+per\s+line|subject\s+to\s+changes|now\s+usd?\s*\$?\s*\d+\s+per)\b/i,
  // Validity / vigencia
  /^\s*(validity|validez|valid\s+(until|from|to)|expires?|vence|expira|fin\s+de\s+\w+)\b/i,
  // EBS / surcharges / BL fee — never go to global notes
  /\b(ebs|efs|baf|emergency\s+bunker|bunker\s+surcharge|bl\s*fee|bill\s+of\s+lading|documentation\s+fee|doc\s+fee)\b/i,
  // Contexto de mercado
  /^\s*(diesel|me\s+war|fuel\s+(rose|increase|surcharge)|due\s+to\s+fuel|market\s+(is|has))/i,
  // Encabezados de sección de carrier
  /^\s*(msc|cma-?cgm|hapag(\s*-?\s*lloyd)?|maersk|ooc|cosco|one|ever|wan\s*hai|hmm|pil|zim|yang\s*ming)\s*:?\s*$/i,
  // Encabezados de tipo de carga
  /^\s*(wine\/?juice|dry|reefer|flexi|frozen|fresh|vegetables|nueces)\s+loads?\s*:?\s*$/i,
  // Encabezados Incoterm + región
  /^\s*(fob|cif|cfr|fca|exw)\s+(chile|argentina|arg|mendoza)\s*:?\s*$/i,
  // Carrier listing as plain assignment
  /^\s*carriers?\s*:\s*[A-Z]/i,
];

// True when the line should pass through to batch.notes. Whitelist beats
// blacklist; an unmatched line passes through too (best-effort filter).
export function isBatchNotesAllowed(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  for (const re of BATCH_NOTES_WHITELIST) {
    if (re.test(t)) return true;
  }
  for (const re of BATCH_NOTES_BLACKLIST) {
    if (re.test(t)) return false;
  }
  return true;
}

// Filters a multi-line batch.notes string by isBatchNotesAllowed and
// returns the trimmed survivors joined back, then dedupes near-duplicate
// lines (Bullet regression: "14/8 free days at origin/destination" + "14
// free days at origin/destination" appearing as two lines). Empty-string
// in / empty-out.
export function filterBatchNotesText(text: string): string {
  if (!text) return "";
  const filtered = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter(isBatchNotesAllowed)
    .join("\n");
  return dedupeBatchNotes(filtered);
}

// Normalization for the dedupe pass: lowercases, drops diacritics, drops
// punctuation, collapses whitespace. Keeps numbers + letters so "14/8"
// and "14" still differ on the digit content.
function normForDup(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Drops near-duplicate lines from a batch-notes string. Strategy:
//  - Sort lines longest-first so the most informative variant survives
//    ("14/8 free days of container use at origin/destination" beats
//    "14 free days of container use at origin/destination").
//  - For each candidate, drop if any already-accepted line:
//    * has the same normalized form, OR
//    * fully contains the candidate's normalized form, OR
//    * differs by ≤ 5 Levenshtein edits AND is similar in length.
//  - Restore source order at the end so user-pinned lines keep their
//    relative position.
//
// Substring inclusion is the dominant signal: "14 free days at origin"
// being a substring of "14/8 free days at origin destination" (after
// normalize) is a clean dedupe trigger. Levenshtein catches variants
// that differ only by a punctuation token a normalize misses.
export function dedupeBatchNotes(text: string): string {
  if (!text) return "";
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length <= 1) return lines.join("\n");
  const indexed = lines.map((l, i) => ({ l, i, n: normForDup(l) }));
  const sorted = [...indexed].sort((a, b) => b.l.length - a.l.length);
  const accepted: typeof indexed = [];
  for (const cand of sorted) {
    let dup = false;
    for (const acc of accepted) {
      if (cand.n === acc.n) {
        dup = true;
        break;
      }
      if (cand.n && acc.n.includes(cand.n)) {
        dup = true;
        break;
      }
      if (acc.n && cand.n.includes(acc.n)) {
        dup = true;
        break;
      }
      if (
        cand.n.length > 12 &&
        Math.abs(cand.n.length - acc.n.length) <= 6 &&
        levenshtein(cand.n, acc.n) <= 5
      ) {
        dup = true;
        break;
      }
    }
    if (!dup) accepted.push(cand);
  }
  accepted.sort((a, b) => a.i - b.i);
  return accepted.map((x) => x.l).join("\n");
}

// Surfaces "two kinds share the same value" warnings to the operator.
// Empirical analysis of 19 catalog files showed value collisions are rare
// (1/17 kind-bearing files) and the one collision was legitimate — so
// this is informational, not blocking. Caller renders a yellow banner.
export function validateKindsValueUniqueness(
  kinds: KindDef[],
  values: KindValue[]
): string[] {
  const buckets = new Map<number, Array<{ label: string; size: string }>>();
  for (const kind of kinds) {
    const kv = values.find((v) => v.kind_id === kind.id);
    if (!kv) continue;
    if (kind.by_size) {
      if (kv.value20 != null) {
        if (!buckets.has(kv.value20)) buckets.set(kv.value20, []);
        buckets.get(kv.value20)!.push({ label: kind.label, size: "20'" });
      }
      if (kv.value40 != null) {
        if (!buckets.has(kv.value40)) buckets.set(kv.value40, []);
        buckets.get(kv.value40)!.push({ label: kind.label, size: "40'" });
      }
    } else if (kv.value_unique != null) {
      if (!buckets.has(kv.value_unique)) buckets.set(kv.value_unique, []);
      buckets
        .get(kv.value_unique)!
        .push({ label: kind.label, size: "único" });
    }
  }
  const out: string[] = [];
  for (const [value, items] of buckets) {
    if (items.length < 2) continue;
    const summary = items
      .map((it) => `${it.label} (${it.size}=${value})`)
      .join(" y ");
    out.push(
      `Posible kind duplicado: ${summary} comparten valor ${value}. ¿Distintos contextos o duplicación?`
    );
  }
  return out;
}

// Post-process dedupe between predefined and custom kinds. Belt-and-braces
// for the case where the LLM emits a label like "Flexitank Chile" via a
// path that hits a predef alias AND another label that doesn't (extra
// suffix, exotic punctuation, by_size flip), producing both flexitank_chile
// (predef) and custom_flexitank_chile in the same batch.
//
// Two signals trigger removal of a custom kind:
//   1) The custom's label resolves to a predef alias (matchKindByAlias).
//      The custom's values are merged into the predef when the predef has
//      a missing slot — so a "Flexitank Chile = 600" hit that landed on
//      the custom by accident still lands its 600 on the predef.
//   2) The custom shares any non-null value with a predef kind. Catches
//      the rare case where alias matching fails twice but the value is
//      the tell-tale signal (e.g. "Insulado Chile" custom with value20=350
//      next to insulado_chile predef value40=350 — same charge, both 350).
//
// The function returns a fresh kinds + values pair; callers replace the
// existing batch state. Order is preserved, predefs come out untouched.
export function dedupeKindsAgainstPredefined(
  kinds: KindDef[],
  values: KindValue[]
): { kinds: KindDef[]; values: KindValue[] } {
  const toRemove = new Set<string>();
  const valuesCopy = values.map((v) => ({ ...v }));
  for (const kind of kinds) {
    if (kind.predefined) continue;
    if (toRemove.has(kind.id)) continue;
    // Signal 1 — alias hit on a predef that's actually present in the batch.
    const aliasHit = matchKindByAlias(kind.label);
    if (aliasHit && kinds.some((k) => k.predefined && k.id === aliasHit)) {
      toRemove.add(kind.id);
      const customKv = valuesCopy.find((v) => v.kind_id === kind.id);
      const predefKv = valuesCopy.find((v) => v.kind_id === aliasHit);
      if (customKv && predefKv) {
        if (predefKv.value20 == null && customKv.value20 != null) {
          predefKv.value20 = customKv.value20;
        }
        if (predefKv.value40 == null && customKv.value40 != null) {
          predefKv.value40 = customKv.value40;
        }
        if (predefKv.value_unique == null && customKv.value_unique != null) {
          predefKv.value_unique = customKv.value_unique;
        }
      }
      continue;
    }
    // Signal 2 — value overlap with a predef.
    const customKv = valuesCopy.find((v) => v.kind_id === kind.id);
    if (!customKv) continue;
    const overlap = kinds.some((other) => {
      if (!other.predefined) return false;
      const okv = valuesCopy.find((v) => v.kind_id === other.id);
      if (!okv) return false;
      const matchPair = (a: number | null | undefined, b: number | null | undefined) =>
        a != null && b != null && a === b;
      if (matchPair(customKv.value20, okv.value20)) return true;
      if (matchPair(customKv.value40, okv.value40)) return true;
      if (
        customKv.value_unique != null &&
        (matchPair(customKv.value_unique, okv.value20) ||
          matchPair(customKv.value_unique, okv.value40) ||
          matchPair(customKv.value_unique, okv.value_unique))
      )
        return true;
      return false;
    });
    if (overlap) {
      toRemove.add(kind.id);
    }
  }
  return {
    kinds: kinds.filter((k) => !toRemove.has(k.id)),
    values: valuesCopy.filter((v) => !toRemove.has(v.kind_id)),
  };
}

// Derives the Incoterm of a rate from whatever signal is available.
// Order of priority (each step short-circuits):
//   1. POL prefixed "FCA " or "EXW "
//   2. POL matches an Argentine pickup city → "FCA"
//   3. notas mention "EXW" → "EXW"
//   4. notas mention "FCA" → "FCA"
//   5. notas mention exactly one of FOB / CIF / CFR → that one
//   6. fallback → "FOB/CIF/CFR"
export function inferIncotermFromContext(input: {
  pol?: string;
  notas?: string;
}): Incoterm {
  const pol = (input.pol ?? "").trim();
  const notas = input.notas ?? "";
  if (/^FCA\b/i.test(pol)) return "FCA";
  if (/^EXW\b/i.test(pol)) return "EXW";
  if (isArgPol(pol)) return "FCA";
  if (/\bEXW\b/i.test(notas)) return "EXW";
  if (/\bFCA\b/i.test(notas)) return "FCA";
  const fobMatch = /\bFOB\b/i.test(notas);
  const cifMatch = /\bCIF\b/i.test(notas);
  const cfrMatch = /\bCFR\b/i.test(notas);
  const matchCount = [fobMatch, cifMatch, cfrMatch].filter(Boolean).length;
  if (matchCount === 1) {
    if (fobMatch) return "FOB";
    if (cifMatch) return "CIF";
    if (cfrMatch) return "CFR";
  }
  return "FOB/CIF/CFR";
}

// Renders a rate's route for display in the Step 2 preview table and the
// RatesTab listing. Priority: pol AND pod with arrow → pod alone → pol
// alone → legacy `route` field (for pre-v3 rates that never had pol/pod
// split out) → em-dash.
export function formatRoute(
  pol: string | undefined,
  pod: string | undefined,
  fallbackRoute?: string | undefined
): string {
  const p = (pol ?? "").trim();
  const d = (pod ?? "").trim();
  if (p && d) return `${p} → ${d}`;
  if (d) return d;
  if (p) return p;
  const fb = (fallbackRoute ?? "").trim();
  if (fb) return fb;
  return "—";
}

export type Rate = {
  id: string;
  agent: string;
  carrier: string;
  // Optional in v3; legacy records and several flows use route as a free-text
  // field that may combine pol+pod. Newer extractions can split them.
  pol?: string;
  pod?: string;
  route: string;
  // Container type narrowed to the v3 union. Existing localStorage records
  // are migrated by migrateRateV3 at module init; new records produced by
  // the extraction pipeline are validated against this union.
  tipo: ContainerType;
  // Shipping line. Distinct from carrier for some agents that route via a
  // particular line — when there's no distinction, sl mirrors carrier.
  sl?: string;
  sf: number;
  blFee: number;
  af: number;
  afMax: number;
  flexiArg: number;
  // v3 dynamic kinds. Optional in the type so seed records and pre-migration
  // localStorage data still type-check; migrateRateV3 always populates both
  // (possibly empty) arrays before downstream rendering / invoicing.
  kind_values?: KindValue[];
  // Per-rate denormalized KindDef list. Lets a rate be self-describing once
  // detached from its batch — invoicing can render columns without needing
  // catalog lookups for custom kinds.
  kinds?: KindDef[];
  // Optional v3 alias for `notes`. Migration sets both to the same value so
  // either reader works. Free-form bullet-style notes (validity overrides,
  // bundle inclusions, market context). PER-RATE — specific to this row.
  notas?: string;
  // v3.2 — billing-relevant trade term resolving "what's included in SF"
  // (port-to-port vs inland-trucking-included). Optional in the type so
  // pre-v3.2 records still type-check; migrateRateV32 stamps every rate
  // with at least "FOB/CIF/CFR" via inferIncotermFromContext.
  incoterm?: Incoterm;
  // Denormalized copy of the batch's notas_globales. Stored on each rate
  // saved in a single batch so the rate is self-contained for invoicing /
  // listing without needing a separate batch lookup table. UI should show
  // it as the rate-level "global" annotation (preferential clients, free
  // days, market context, etc.) distinct from `notas`/`notes`. Optional —
  // older rates created before this field land WITHOUT it.
  batch_notas_globales?: string;
  // ----- Legacy fixed-shape fields (kept so older records still type-check
  // and so InvoicingTab's fallback chain works during the transition). -----
  additionalCosts?: AdditionalCost[];
  thermalLinerChile20?: number;
  thermalLinerChile40?: number;
  thermalLinerMendoza20?: number;
  thermalLinerMendoza40?: number;
  fcaHaulageMendoza20?: number;
  fcaHaulageMendoza40?: number;
  discountInsulated?: number;
  additionalNotes?: string;
  thermalLiner20?: number;
  thermalLiner40?: number;
  fcaHaulage20?: number;
  fcaHaulage40?: number;
  validFrom: string;
  validTo: string;
  notes: string;
};

// Batch wrapper produced by NewRateFlow during extraction. Not persisted as
// a single record — once the user confirms the preview, individual Rate rows
// are saved (each carrying its own `kinds` denormalized from this batch).
export type RateBatch = {
  agent_id: string;
  validFrom: string;
  validTo: string;
  kinds: KindDef[];
  rates: Rate[];
  notas_globales: string;
};

// Helper used by the migration below and the new flow when persisting.
function makeCostId(): string {
  return `cost-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Builds an AdditionalCost entry. Centralized so the new-flow UI and the
// migration produce the same shape.
export function buildAdditionalCost(
  kind: AdditionalCostKind,
  label: string,
  value: number,
  applies: AppliesTo
): AdditionalCost {
  return { id: makeCostId(), kind, label, value, applies };
}

// Maps the 834ad41 AdditionalCostKind onto v3 kind ids. "other" is handled
// specially: a custom kind is generated from the cost's free-text label.
const LEGACY_KIND_MAP: Partial<Record<AdditionalCostKind, string>> = {
  thermal_chile: "insulado_chile",
  thermal_mendoza: "insulado_arg",
  fca_haulage_mendoza: "precarriage_mendoza",
  flexitank_chile: "flexitank_chile",
  flexitank_argentina: "flexitank_arg",
  agency_fee: "agency_fee",
  agency_fee_max: "agency_fee_max",
  discount_insulated: "discount_insulated",
};

// Slug helper used to derive stable ids for custom kinds. Conservative:
// lowercase + ascii + replace non-alphanumeric with underscore.
export function slugifyKindLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "misc";
}

// Normalizes a label so the alias matcher tolerates punctuation, casing, the
// "base port" suffix some agents append, and the "FCA " prefix used before
// Haulage/Mendoza variants (we intentionally don't strip "FCA " when followed
// directly by "Mendoza" — that's a meaningful match target on its own).
function normalizeKindLabel(s: string): string {
  let out = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  out = out.replace(/\s+base port$/, "");
  out = out.replace(/^fca\s+(haulage|haulajes?)\b/, "$1");
  return out;
}

// Strips a size annotation (20' / 20'DC / 20'Flexi / 40' / 40'HC) from a
// kind label so the alias matcher can resolve canonical labels like
// "Precarriage 20'Flexi Mendoza" → "Precarriage Mendoza" + size: 20.
// The size hint then routes a value_unique to value20 or value40 instead
// of duplicating to both. Returns the cleaned label trimmed of redundant
// whitespace plus the parsed size (20 | 40 | null).
export function extractSizeFromKindLabel(label: string): {
  cleanLabel: string;
  size: 20 | 40 | null;
} {
  if (!label) return { cleanLabel: "", size: null };
  const sizeRegex = /\b(20|40)\s*['"′]?\s*(?:dc|hc|flexi|fl|reefer|rf)?\b/i;
  const m = label.match(sizeRegex);
  if (!m) return { cleanLabel: label.trim(), size: null };
  const size = m[1] === "20" ? 20 : 40;
  const cleanLabel = label
    .replace(sizeRegex, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { cleanLabel, size };
}

// Returns the predefined kind id for a label, or null if no alias matches.
export function matchKindByAlias(label: string): string | null {
  const norm = normalizeKindLabel(label);
  if (!norm) return null;
  for (const kindId of Object.keys(KIND_ALIASES)) {
    for (const alias of KIND_ALIASES[kindId]!) {
      if (alias instanceof RegExp) {
        if (alias.test(norm)) return kindId;
      } else {
        const a = normalizeKindLabel(alias);
        if (norm === a || norm.includes(a)) return kindId;
      }
    }
  }
  return null;
}

// Splits a v3 ContainerType into its size-and-category components. Used by
// invoicing to pick value20 vs value40 from a kind, and by UI to decide
// which scope/by_size combinations are renderable for a rate.
export function splitContainerType(tipo: ContainerType): {
  size: 20 | 40;
  category: "Dry" | "Reefer" | "Flexi";
} {
  switch (tipo) {
    case "20'Dry":
      return { size: 20, category: "Dry" };
    case "40'Dry":
      return { size: 40, category: "Dry" };
    case "40'Reefer":
      return { size: 40, category: "Reefer" };
    case "20'Flexi":
      return { size: 20, category: "Flexi" };
  }
}

// True when a kind's scope is compatible with a rate's container type. Reefer
// rates skip dry-only kinds (and vice versa); "all" applies everywhere. The
// Flexi category is treated as dry-equivalent for scope purposes.
export function kindAppliesToTipo(scope: KindScope, tipo: ContainerType): boolean {
  if (scope === "all") return true;
  const cat = splitContainerType(tipo).category;
  if (scope === "reefer") return cat === "Reefer";
  return cat !== "Reefer"; // dry → Dry or Flexi
}

// Picks the right value off a kind value based on the rate's size when the
// kind is by_size, or returns value_unique otherwise. Returns 0 when nothing
// resolves so callers can sum without nullable handling.
export function readKindValueFor(
  kv: KindValue,
  def: KindDef,
  tipo: ContainerType
): number {
  if (!def.by_size) return kv.value_unique ?? 0;
  return splitContainerType(tipo).size === 20
    ? kv.value20 ?? 0
    : kv.value40 ?? 0;
}

// Coerces a free-form tipo string to one of the four v3 ContainerType
// literals. Inter-Tank's catalog has exactly 4 valid types — "20'Dry",
// "20'Flexi", "40'Dry", "40'Reefer" — and nothing else. The function
// detects size + category from the source string using a small, explicit
// keyword set (no commodity inference; "Wine", "Juice", "Frozen" etc.
// never determine the type). When the source implies a non-existent
// combination ("20'Reefer" or "40'Flexi"), the function returns the
// closest valid type plus a helpful note that the caller surfaces in
// notas + flags via tipoCoerced for needs-review.
//
// Detection keywords:
//   Reefer: /\b(reefer|rf|refrigerada|refrigerated)\b/i
//   Flexi:  /\b(flexi|flexitank|flexibag)\b/i  (also matches "flexi-tank")
// Size:
//   40 → /^40\b/  20 → /^20\b/  (digit immediately at the start)
export function migrateContainerType(raw: string): {
  tipo: ContainerType;
  note?: string;
} {
  const original = (raw ?? "").toString();
  const tNorm = original
    .trim()
    .toUpperCase()
    .replace(/['']/g, "'")
    .replace(/\s+/g, "")
    .replace(/-/g, "");
  if (!tNorm) return { tipo: "20'Dry" };
  const isReefer = /(?:^|[^A-Z])(REEFER|RF|REFRIGERAD[AO]|REFRIGERATED)/.test(
    tNorm
  );
  const isFlexi = /FLEXI(?:TANK|BAG)?|FLEXITANK|FLEXIBAG/.test(tNorm);
  const isForty = /^40/.test(tNorm);
  const isTwenty = /^20/.test(tNorm);

  if (isForty && isReefer) return { tipo: "40'Reefer" };
  if (isTwenty && isReefer) {
    return {
      tipo: "20'Dry",
      note: `Tipo no estándar: 20'Reefer no existe en Inter-Tank — ¿es 40'Reefer? Original: "${original}".`,
    };
  }
  if (isTwenty && isFlexi) return { tipo: "20'Flexi" };
  if (isForty && isFlexi) {
    return {
      tipo: "40'Dry",
      note: `Tipo no estándar: 40'Flexi no existe en Inter-Tank — ¿es 20'Flexi? Original: "${original}".`,
    };
  }
  if (isForty) return { tipo: "40'Dry" };
  if (isTwenty) return { tipo: "20'Dry" };
  if (isFlexi) return { tipo: "20'Flexi" };
  if (isReefer) return { tipo: "40'Reefer" };
  return {
    tipo: "20'Dry",
    note: `Tipo no detectado, asumido 20'Dry. Original: "${original}".`,
  };
}

// Parses a compound SF cell like "USD 1450 + USD 60 BL Fee + EBS USD 75" into
// { sf, blFee }, dropping any EBS/EFS terms. Tolerates many phrasings: "+ EBS",
// "+ EFS USD X", "EBS USD X per teu/ctr/BL", "USD 580 + USD 40xbl + EBS".
// Returns 0 for fields that don't appear; dropped EBS is signalled via the
// boolean so the UI can confirm the source row was understood.
export function parseSfCell(cell: string): {
  sf: number;
  blFee: number;
  ebsDescartado: boolean;
} {
  if (!cell) return { sf: 0, blFee: 0, ebsDescartado: false };
  const original = String(cell);
  let stripped = original;
  let ebsDescartado = false;
  // Drop "+ EBS [USD X] [per teu/ctr/BL/bl]" anywhere in the string.
  const ebsRe =
    /[+,]?\s*\b(?:ebs|efs)\b(?:\s+usd\s*[\d.,]+)?(?:\s+per\s+(?:teu|ctr|bl|container))?/gi;
  if (ebsRe.test(stripped)) {
    ebsDescartado = true;
    stripped = stripped.replace(ebsRe, " ");
  }
  // Find a BL Fee number: "USD X BL Fee", "USD X per BL", "X xbl", "X per bl"
  let blFee = 0;
  const blMatch =
    stripped.match(
      /(?:usd\s*)?(\d[\d.,]*)\s*(?:bl\s*fee|per\s*bl|xbl|x\s*bl|\/bl)/i
    );
  if (blMatch) {
    blFee = parseAmount(blMatch[1] ?? "");
    stripped = stripped.replace(blMatch[0], " ");
  }
  // First USD-prefixed number left → SF. Fallback: first standalone number.
  let sf = 0;
  const sfUsd = stripped.match(/usd\s*([\d.,]+)/i);
  if (sfUsd) {
    sf = parseAmount(sfUsd[1] ?? "");
  } else {
    const m = stripped.match(/(\d[\d.,]*)/);
    if (m) sf = parseAmount(m[1] ?? "");
  }
  return { sf, blFee, ebsDescartado };
}

function parseAmount(s: string): number {
  if (!s) return 0;
  // Accept "1.600" (Spanish thousands) and "1,600.50" (English) — drop dots
  // when there's no decimal portion, normalize commas.
  let t = s.replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) {
    // Spanish: dots = thousands, comma = decimal
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) {
    // English: commas = thousands
    t = t.replace(/,/g, "");
  } else {
    t = t.replace(/,/g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

// Detects multi-carrier strings like "OOCL or CMA", "OOCL/EVER", "Carriers:
// OOCL, EVER" and returns the individual carriers. Returns the original string
// (single-element array) when no multi-carrier signal is present.
export function parseMultiCarrier(sl: string): string[] {
  const s = (sl ?? "").trim();
  if (!s) return [s];
  const carriersPrefix = s.match(/^carriers?:\s*(.+)$/i);
  if (carriersPrefix) {
    return splitCarrierList(carriersPrefix[1] ?? "");
  }
  // " or " separator
  if (/\s+or\s+/i.test(s)) {
    return s
      .split(/\s+or\s+/i)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  // "/" separator (only when both sides look like reasonable carrier names)
  if (/^[A-Za-z][A-Za-z\s-]+\s*\/\s*[A-Za-z][A-Za-z\s-]+$/.test(s)) {
    return s
      .split("/")
      .map((p) => p.trim())
      .filter(Boolean);
  }
  return [s];
}

function splitCarrierList(rest: string): string[] {
  return rest
    .split(/[,/]| or /i)
    .map((p) => p.trim())
    .filter(Boolean);
}

// ===== Asian PODs and needs-review classification =====
//
// When a rate's POD matches one of these, sf<=0 (zero or negative) is treated
// as a legitimate differential rate rather than a flag for review. Hand-
// curated from observed agent fixtures; extend manually when new ports
// appear (Busan, Manila, Kaohsiung, etc.). Match is EXACT on the normalized
// string — no Levenshtein, no regex.
export const ASIAN_PODS: ReadonlySet<string> = new Set([
  // China
  "chongqing",
  "dalian",
  "fuzhou",
  "guangzhou",
  "haikou",
  "hong kong",
  "huangpu",
  "jiangyin",
  "jiaoxin",
  "lian hua shan",
  "lianyungang",
  "nansha",
  "nantong",
  "ningbo",
  "qingdao",
  "sanya",
  "shanghai",
  "shantou",
  "shekou",
  "taizhou",
  "tianjin",
  "wenzhou",
  "wuhan",
  "xiamen",
  "xingang",
  "yantai",
  "yantian",
  "zhuhai",
  // Japan
  "fukuoka",
  "hakata",
  "hiroshima",
  "kanazawa",
  "kobe",
  "kushiro",
  "moji",
  "nagoya",
  "naha",
  "niigata",
  "osaka",
  "sendai",
  "shimizu",
  "tokyo",
  "tomakomai",
  "toyama",
  "yokohama",
  // South Korea
  "busan",
  "gwangyang",
  "incheon",
  "masan",
  "mokpo",
  "pyeongtaek",
  "ulsan",
  // Taiwan
  "kaohsiung",
  "keelung",
  "taichung",
  "taipei",
  // Vietnam
  "cai mep",
  "da nang",
  "haiphong",
  "ho chi minh",
  "qui nhon",
  "vung tau",
  // Cambodia
  "sihanoukville",
  // Thailand
  "bangkok",
  "laem chabang",
  "map ta phut",
  "songkhla",
  // Malaysia
  "bintulu",
  "johor",
  "kuantan",
  "pasir gudang",
  "penang",
  "port klang",
  "tanjung pelepas",
  // Singapore
  "jurong",
  "singapore",
  // Indonesia
  "belawan",
  "jakarta",
  "semarang",
  "surabaya",
  "tanjung perak",
  "tanjung priok",
  // Philippines
  "cebu",
  "davao",
  "general santos",
  "iloilo",
  "manila",
  "subic",
  // Bangladesh
  "chittagong",
  "dhaka",
  "mongla",
  // India (included: geographically Asia, operationally similar pricing
  // patterns to SE Asia. Split out if a future agent prices India distinctly.)
  "chennai",
  "cochin",
  "jnpt",
  "mumbai",
  "mundra",
  "nhava sheva",
  "pipavav",
  "tuticorin",
  "vizag",
  // Sri Lanka
  "colombo",
  "hambantota",
]);

export function isAsianPod(pod: string): boolean {
  if (!pod) return false;
  const norm = pod.trim().toLowerCase().replace(/\s+/g, " ");
  return ASIAN_PODS.has(norm);
}

// True when the raw value can be parsed as a finite number. Distinguishes
// legitimate missing/invalid extraction ("TBD", "Ask agent", undefined,
// empty string) from numeric zero — those return false here even though a
// permissive Number() coercion might map them to 0.
export function isParsableNumber(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v !== "string") return false;
  const trimmed = v.trim();
  if (!trimmed) return false;
  if (!/\d/.test(trimmed)) return false;
  const cleaned = trimmed.replace(/[^0-9.,-]/g, "");
  if (!cleaned) return false;
  const n = Number(cleaned.replace(",", "."));
  return Number.isFinite(n);
}

const MONTH_INDEX: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_TOKEN = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";

// Coerces a loose date value into ISO yyyy-mm-dd. Recognized formats:
//   - "2026-06-30" (ISO)
//   - "2026-06-30T00:00:00" (ISO with time — strips time)
//   - "30/06/2026" / "30/06/26" / "30/06" (dd/mm/[yy[yy]])
//   - "30-Jun" / "30 Jun" / "30/Jun" (no year — uses batchYearHint)
//   - "30-Jun-26" / "30-Jun-2026"
//   - "Jun 30, 2026"
// `batchYearHint`: the year to use when the source omits one. Callers
// pass the year of the batch's effective validity so emails like Bullet
// "31/6" or Valle Redondo "Fin de JUNIO" land in the batch's intended
// year (2026) rather than the system's current year (which would be
// wrong if the user is preparing rates for a future quarter).
export function normalizeDateString(
  value: unknown,
  batchYearHint?: number
): string {
  if (value === undefined || value === null) return "";
  const s = String(value).trim();
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2]!.padStart(2, "0")}-${iso[3]!.padStart(2, "0")}`;
  }
  // dd/mm[/yyyy|/yy] — including no-year case
  const dmShort = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (dmShort) {
    let yy = dmShort[3];
    if (!yy) yy = String(batchYearHint ?? new Date().getFullYear());
    if (yy.length === 2) yy = "20" + yy;
    return `${yy}-${dmShort[2]!.padStart(2, "0")}-${dmShort[1]!.padStart(2, "0")}`;
  }
  const dmmm = s.match(
    new RegExp(
      `^(\\d{1,2})[-\\s/](${MONTH_TOKEN})(?:[-\\s/](\\d{2,4}))?\\b`,
      "i"
    )
  );
  if (dmmm) {
    const day = dmmm[1]!.padStart(2, "0");
    const monthIdx = MONTH_INDEX[dmmm[2]!.toLowerCase()];
    if (monthIdx) {
      const mm = String(monthIdx).padStart(2, "0");
      let yy = dmmm[3] ?? String(batchYearHint ?? new Date().getFullYear());
      if (yy.length === 2) yy = "20" + yy;
      return `${yy}-${mm}-${day}`;
    }
  }
  const mmmd = s.match(
    new RegExp(`^(${MONTH_TOKEN})\\s+(\\d{1,2}),?\\s+(\\d{4})`, "i")
  );
  if (mmmd) {
    const monthIdx = MONTH_INDEX[mmmd[1]!.toLowerCase()];
    if (monthIdx) {
      return `${mmmd[3]}-${String(monthIdx).padStart(2, "0")}-${mmmd[2]!.padStart(2, "0")}`;
    }
  }
  return s;
}

// True when the value parses to a real calendar date. Accepts the formats
// recognized by normalizeDateString. Calendar-impossible dates (31 of
// June, 30 of February) return false — the JS Date constructor would
// silently roll them over to the next month otherwise.
export function isValidDate(v: unknown, batchYearHint?: number): boolean {
  return parseDateValue(v, batchYearHint) !== null;
}

// Parses any of the supported date formats into a Date set to local
// midnight. Returns null when the value isn't a parseable date format OR
// when it's calendar-impossible. Roundtrip-checks year/month/day after
// constructing the Date so 31/6 and 30/2 never sneak through.
function parseDateValue(v: unknown, batchYearHint?: number): Date | null {
  const normalized = normalizeDateString(v, batchYearHint);
  if (!normalized) return null;
  const m = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const dt = new Date(
    `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}T00:00:00`
  );
  if (Number.isNaN(dt.getTime())) return null;
  if (
    dt.getFullYear() !== yyyy ||
    dt.getMonth() !== mm - 1 ||
    dt.getDate() !== dd
  ) {
    return null;
  }
  return dt;
}

// True when the value parses to a date strictly before today (local
// midnight). Used by isRateNeedsReview to flag expired rates so the user
// reviews them before saving.
export function isDateInPast(v: unknown, batchYearHint?: number): boolean {
  const dt = parseDateValue(v, batchYearHint);
  if (!dt) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dt.getTime() < today.getTime();
}

// True when both values represent the same calendar date. Goes through
// parseDateValue so format mismatches ("30-Jun" vs "2026-06-30") still
// match. Returns false when either side fails to parse.
export function datesEqual(
  a: unknown,
  b: unknown,
  batchYearHint?: number
): boolean {
  const da = parseDateValue(a, batchYearHint);
  const db = parseDateValue(b, batchYearHint);
  if (!da || !db) return false;
  return da.getTime() === db.getTime();
}

// Single source of truth for the "needs review" classification used by the
// Step 2 banner, the visible-rows filter, and the per-row red highlight.
//
// A rate goes in the bucket when extraction failed in a way the user must
// reconcile:
//   - missing pol / pod
//   - container type outside the v3 union
//   - sf or bl_fee not parseable as a number
//   - validFrom / validTo not valid dates (after applying batch defaults)
//   - sf <= 0 with a NON-Asian POD (Asian POD permits differential rates)
//   - bl_fee <= 0 with a non-Asian POD OR a Reefer rate (Asian dry/flexi
//     routes commonly bundle BL fee into SF; reefers always charge it)
//
// "Weird but legitimate" — SF=0, SF<0 on Asian routes, BL Fee=0 on Asian
// dry routes, empty kinds, long notas, bundle inclusions — DOES NOT trigger
// review.
export function isRateNeedsReview(
  input: {
    pol: string;
    pod: string;
    tipo: string;
    // True when the source tipo had to be coerced because it wasn't already
    // one of the four v3 ContainerType values (e.g. "20'RF", "40'Flexi",
    // "Dry" without size, blank).
    tipoCoerced?: boolean;
    // Numeric values already extracted (caller does the parse).
    sfNum: number;
    blFeeNum: number;
    // Parseability of the raw source values. False when the source emitted
    // tokens like "TBD" or "Ask agent" that toNumber() would silently
    // coerce to 0 — those need to be flagged distinctly from legitimate 0.
    sfParseable: boolean;
    blFeeParseable: boolean;
  },
  // Validity is now ALWAYS batch-level — Inter-Tank rates inherit the
  // batch's Q1/Q2/Q3/Q4 (or explicit date range) at save time and a
  // per-row override is no longer supported. The function uses
  // batchValidity directly without a per-row fallback.
  batchValidity: { validFrom?: string; validTo?: string } | null,
  batchYearHint?: number
): boolean {
  // POL is allowed to be empty (chilean implicit per the v3.2 POL/POD-by-
  // context rules — see RATE_SYSTEM rule 11.A1). Only POD is enforced
  // here; missing POD also has its own _blockingError path that takes
  // priority over the yellow needs-review highlight.
  if (!input.pod.trim()) return true;
  if (input.tipoCoerced) return true;
  if (!(CONTAINER_TYPES as readonly string[]).includes(input.tipo)) return true;
  if (!input.sfParseable) return true;
  if (!input.blFeeParseable) return true;

  if (input.sfNum <= 0 && !isAsianPod(input.pod)) return true;

  if (input.blFeeNum <= 0) {
    const isReefer = input.tipo === "40'Reefer";
    if (!isAsianPod(input.pod) || isReefer) return true;
  }

  const effFrom = batchValidity?.validFrom ?? "";
  const effTo = batchValidity?.validTo ?? "";
  if (!isValidDate(effFrom, batchYearHint) || !isValidDate(effTo, batchYearHint))
    return true;
  // Validity vencida: when the batch's validTo is before today, every row
  // of the batch is technically expired. Flagging per-row is consistent
  // with how the user reviews each rate before saving.
  if (isDateInPast(effTo, batchYearHint)) return true;

  return false;
}

// ===== Preferential-client kind detection =====
//
// Some agents (WENRAN being the canonical case) define alternative kind
// values restricted to specific customer codes by appending the customer
// list to the kind label, e.g. "Thermal Liner S&F Chile (ASC - Aussino -
// EMW)". These should NOT become global kinds of the batch — the
// preferential rate only applies to those clients. Instead they go to
// notas_globales as free-form context.
//
// Heuristic: the parenthetical content qualifies as a customer list when:
//   - has at least 4 chars
//   - contains NO digits (digits would suggest a unit annotation like "20'")
//   - doesn't contain unit tokens (USD, TEU, CTR, BL, FCL, LCL, 20', 40')
//
// Returns the cleaned (paren-stripped) label plus the parsed customer
// names. Returns null when the label has no parenthetical or the content
// fails the heuristic.
export function extractPreferentialClientsFromLabel(label: string): {
  cleanLabel: string;
  clients: string[];
} | null {
  if (!label) return null;
  const m = label.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (!m) return null;
  const base = (m[1] ?? "").trim();
  const paren = (m[2] ?? "").trim();
  if (paren.length < 4) return null;
  if (/\d/.test(paren)) return null;
  if (/\b(USD|TEU|CTR|BL|FCL|LCL|HC|RF)\b/i.test(paren)) return null;
  if (/['"′]/.test(paren)) return null;
  const clients = paren
    .split(/\s*[-/,;]\s*|\s+y\s+|\s+and\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 40);
  if (clients.length === 0) return null;
  return { cleanLabel: base, clients };
}

// Consolidates a list of preferential-rate entries (one per kind label
// that carried a (Client A - Client B) suffix) into one human-readable
// line per distinct client group. Entries sharing the same client list
// are merged onto one line so the user gets:
//   "Tarifa preferencial para clientes ASC, Aussino, EMW: Insulado Chile USD 180/280, Insulado Argentina USD 230/330"
// instead of two separate sentences for the same trio.
export function consolidatePreferentialNotes(
  entries: Array<{
    clients: string[];
    kindLabel: string;
    value20?: number;
    value40?: number;
    value_unique?: number;
  }>
): string[] {
  if (entries.length === 0) return [];
  const groups = new Map<
    string,
    { clients: string[]; items: typeof entries }
  >();
  for (const e of entries) {
    const key = e.clients.map((c) => c.toLowerCase()).sort().join("|");
    if (!groups.has(key)) groups.set(key, { clients: e.clients, items: [] });
    groups.get(key)!.items.push(e);
  }
  const lines: string[] = [];
  for (const { clients, items } of groups.values()) {
    const parts = items.map((e) => {
      let val = "";
      if (e.value20 !== undefined && e.value40 !== undefined) {
        val = `USD ${e.value20}/${e.value40}`;
      } else if (e.value20 !== undefined) {
        val = `USD ${e.value20} (20')`;
      } else if (e.value40 !== undefined) {
        val = `USD ${e.value40} (40')`;
      } else if (e.value_unique !== undefined) {
        val = `USD ${e.value_unique}`;
      }
      return val ? `${e.kindLabel} ${val}` : e.kindLabel;
    });
    lines.push(
      `Tarifa preferencial para clientes ${clients.join(", ")}: ${parts.join(", ")}`
    );
  }
  return lines;
}

// ===== Free-text kind sweep detectors =====
//
// These run as a defense-in-depth pass after structured extraction: if Claude
// missed promoting a kind (because the source had it as free-form text in a
// margin or text box rather than a column), the regex below salvages it.
// Each returns the numeric value when the pattern matches, null otherwise.

export function detectDiscountInsulated(text: string): number | null {
  if (!text) return null;
  const patterns = [
    /discount\s+(?:of\s+)?usd\s+([\d.,]+)\s+(?:will\s+be\s+applied\s+)?if\s+(?:the\s+)?(?:cargo\s+is\s+)?insulated/i,
    /descuento\s+(?:de\s+)?usd\s+([\d.,]+)\s+si\s+(?:el\s+)?(?:cargo\s+es\s+)?insulado/i,
    /descuento\s+insulado[:\s]+\$?(?:usd\s*)?([\d.,]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const n = parseAmount(m[1]);
      if (n > 0) return -n; // discount → stored as negative value_unique
    }
  }
  return null;
}

export function detectAgencyFee(text: string): number | null {
  if (!text) return null;
  // Avoid matching "Agency Fee Max ..." here — that's a different kind.
  const patterns = [
    /agentfee\s+usd\s+([\d.,]+)(?!\s*max)/i,
    /agency\s*fee[:\s]+(?:usd\s*)?([\d.,]+)(?!\s*max)/i,
    /agencia[:\s]+(?:usd\s*)?([\d.,]+)(?!\s*max)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const n = parseAmount(m[1]);
      if (n > 0) return n;
    }
  }
  return null;
}

export function detectAgencyFeeMax(text: string): number | null {
  if (!text) return null;
  const patterns = [
    /max\s+usd\s+([\d.,]+)\s*(?:x|per)\s*bl/i,
    /agency\s*fee\s*max[:\s]+(?:usd\s*)?([\d.,]+)/i,
    /agentfee\s*max[:\s]+(?:usd\s*)?([\d.,]+)/i,
    /tope\s+agencia[:\s]+(?:usd\s*)?([\d.,]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const n = parseAmount(m[1]);
      if (n > 0) return n;
    }
  }
  return null;
}

export function detectDisposal(text: string): number | null {
  if (!text) return null;
  const patterns = [
    /disposal\s+flexibag[:\s]+(?:usd\s*)?([\d.,]+)/i,
    /cargo\s+disposal[:\s]+(?:usd\s*)?([\d.,]+)/i,
    /disposal[:\s]+(?:usd\s*)?([\d.,]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const n = parseAmount(m[1]);
      if (n > 0) return n;
    }
  }
  return null;
}

// Detects free-text add-ons of the form
//   "Add San Carlos US$ 200 on top of Mendoza"
//   "Additional Rivadavia US$ 100 on top of Mendoza"
//   "Add San Carlos = US$ 200 on top of Mendoza"  (IWS Excel Precarriage sheet)
// and returns one canonical line per distinct (city, base) pair, ready
// to drop into notas_globales:
//   "Add San Carlos = US$ 200 on top of Mendoza"
// Accepts both "Add" (IWS-style) and "Additional" (Arterra-style) leads, with
// or without a "=" separator between city and the USD amount.
export function detectRegionalAddons(text: string): string[] {
  if (!text) return [];
  const lines = new Map<string, string>();
  const re =
    /\b(?:add|additional)\s+([A-Za-zñáéíóúÑÁÉÍÓÚ][A-Za-zñáéíóúÑÁÉÍÓÚ\s]{1,30}?)\s*(?:=\s*)?US\$?\s+([\d.,]+)\s+on\s+top\s+of\s+([A-Za-zñáéíóúÑÁÉÍÓÚ][\w\sñ]{1,30}?)(?=[.,;\n]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const city = (m[1] ?? "").trim().replace(/\s+/g, " ");
    const amountStr = (m[2] ?? "").trim();
    const base = (m[3] ?? "").trim().replace(/\s+/g, " ");
    if (!city || !base) continue;
    const amount = parseAmount(amountStr);
    if (!amount || amount <= 0) continue;
    const key = `${city.toLowerCase()}|${base.toLowerCase()}`;
    lines.set(key, `Add ${city} = US$ ${amount} on top of ${base}`);
  }
  return Array.from(lines.values());
}

// Result of an excluded-kind capture from free-text comments. Phrases like
// "Doesn't included Disposal USD 190" / "NOT included Disposal USD 50" /
// "Excluyendo Disposal USD 100" name a kind that's NOT bundled into SF
// and ALSO carry its USD value. The KATAOKA fixture has these in a
// Comments column on each rate row; the parser used to detect the kind
// label but lose the value (no = separator), leaving the kind editor with
// "Disposal · —" instead of "Disposal · 190". The capture also feeds a
// strip pass so the LLM doesn't see "USD 190" floating mid-cell.
export type ExcludedKindHit = {
  rawPhrase: string;        // exact substring matched, for stripping from text
  kindLabel: string;        // raw label, e.g. "Disposal"
  kindId: string;           // predefined id (matchKindByAlias) or custom slug
  value: number;
};

export function detectExcludedKindsFromText(text: string): {
  hits: ExcludedKindHit[];
  sanitizedText: string;
} {
  if (!text) return { hits: [], sanitizedText: text };
  // Match phrases like:
  //   "Doesn't included Disposal USD 190"
  //   "doesn't include disposal USD 50"
  //   "NOT included Disposal USD 190"
  //   "excluding disposal USD 75"
  //   "Excluyendo Disposal USD 100"
  //   "no incluye Disposal USD 50"
  //   "sin Disposal USD 50"
  // The kind label is greedy but bounded: a single capitalised or lowercase
  // word (optionally with a few following lowercase tokens) before the USD
  // amount. The "Rate includes ..." / "supervision of ..." inclusive
  // sentences explicitly DO NOT match — the leading exclusion verb is
  // required.
  const re =
    /(?:doesn'?t\s+include[d]?|not\s+included|excluding|excluyendo|no\s+incluye|sin\s+(?:incluir\s+)?)\s+([A-Za-zñáéíóúÑÁÉÍÓÚ][A-Za-zñáéíóúÑÁÉÍÓÚ\s]{1,30}?)\s+(?:USD|US\$|\$)\s*([\d.,]+)/gi;
  const hits: ExcludedKindHit[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const rawPhrase = m[0];
    const kindLabel = (m[1] ?? "")
      .trim()
      .replace(/[.,;:]+$/, "")
      .replace(/\s+/g, " ");
    const valueStr = m[2] ?? "";
    if (!kindLabel) continue;
    const value = parseAmount(valueStr);
    if (!value || value <= 0) continue;
    const aliasId = matchKindByAlias(kindLabel);
    const kindId = aliasId ?? `custom_${slugifyKindLabel(kindLabel)}`;
    const dedupeKey = `${kindId}|${value}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    hits.push({ rawPhrase, kindLabel, kindId, value });
  }
  // Strip every matched phrase from the sanitized output. Use a fresh
  // regex (the loop above consumed `re.lastIndex`) and replace globally.
  const stripRe =
    /(?:doesn'?t\s+include[d]?|not\s+included|excluding|excluyendo|no\s+incluye|sin\s+(?:incluir\s+)?)\s+[A-Za-zñáéíóúÑÁÉÍÓÚ][A-Za-zñáéíóúÑÁÉÍÓÚ\s]{1,30}?\s+(?:USD|US\$|\$)\s*[\d.,]+/gi;
  const sanitizedText = text.replace(stripRe, "");
  return { hits, sanitizedText };
}

// ===== Rate-range validation (sanity hard rules) =====
//
// Twelve-year-stable price-band heuristics for the shipping rates
// Inter-Tank manages. Modes:
//   - "warning"  → flag the row yellow but the user can save anyway
//                  (slot-release negatives in Asia / FCA bundles with
//                  high SF are legitimate and only warn the operator).
//   - "blocking" → flag red, uncheck by default, save excludes the row
//                  (Reefer SF outside 999-10000 is almost always a
//                  typo or a Thermal Liner kind being misread as a
//                  rate row — never a legitimate ocean Reefer rate).
//
// Inland AR/CL has high natural variability (truck rate fluctuations,
// city-to-port distance, fuel surcharges) so it's intentionally NOT
// validated here.
export const RATE_RANGES: Record<
  string,
  { min: number; max: number; mode: "warning" | "blocking" }
> = {
  // Dry / Flexi can be NEGATIVE legitimately on Asian routes (slot
  // release / spot reductions) and HIGH legitimately on FCA bundles
  // (Mendoza / Santa Rita / etc. inland trucking included in SF — see
  // Arterra FCA ARG → Montreal SF=6680).
  "20'Dry": { min: -300, max: 5000, mode: "warning" },
  "20'Flexi": { min: -300, max: 6000, mode: "warning" },
  "40'Dry": { min: -300, max: 8000, mode: "warning" },
  // 40'Reefer ocean rates have NEVER fallen below ~999 USD or risen
  // above ~10000 USD in 12+ years of Inter-Tank's history. A value
  // outside this band almost certainly means a Thermal Liner / Insulado
  // kind value got mistaken for a rate (e.g. "Thermal Liner = USD 350"
  // → SF=350) or a typo. BLOCKING.
  "40'Reefer": { min: 999, max: 10000, mode: "blocking" },
};

// Range-validation result: null when the rate's tipo isn't in
// RATE_RANGES (e.g. inland-only, or a future tipo). When present,
// severity drives the UI treatment (yellow/warning vs red/blocking).
export type RateRangeFlag = {
  severity: "warning" | "blocking";
  message: string;
};

// Applies the RATE_RANGES band check. Returns null when the rate is
// inside the band. NOTE: the previous FCA-bundle bypass was removed
// — Inter-Tank's data model does not infer FCA from POL / notas. High
// SFs on legitimate FCA bundles (Arterra Argentina → Montreal SF=6680,
// HCL FCA Santa Rita SF=2905) yield warnings the user can dismiss by
// simply saving — they're informational, not blocking.
export function validateRateRange(rate: {
  tipo: string;
  sf: number;
}): RateRangeFlag | null {
  const band = RATE_RANGES[rate.tipo];
  if (!band) return null;

  if (band.mode === "blocking") {
    if (rate.sf < band.min || rate.sf > band.max) {
      return {
        severity: "blocking",
        message: `SF=${rate.sf} fuera del rango Reefer (${band.min}-${band.max}). Probable error de tipeo o confusión con kind insulado/thermal liner. Verificá tipo y monto antes de guardar.`,
      };
    }
    return null;
  }

  if (rate.sf < band.min) {
    return {
      severity: "warning",
      message: `SF=${rate.sf} debajo del mínimo razonable para ${rate.tipo} (${band.min}). Verificá si es slot release asiático o un error.`,
    };
  }
  if (rate.sf > band.max) {
    return {
      severity: "warning",
      message: `SF=${rate.sf} por encima del máximo razonable para ${rate.tipo} (${band.max}). ¿Es bundle FCA o inland incluido?`,
    };
  }
  return null;
}

// True when a string is a country / region label without a specific
// port — emails sometimes write "Chile" / "Argentina" / "Mendoza" as
// POL or POD when the source had no actual port name. Used by the
// phantom-rate defense in NewRateFlow as a signal the row is likely
// a kind that leaked into rates[]. Match is exact (after trimming /
// lowercasing); compound strings like "Chile - Hamburg" stay safe.
const COUNTRY_NOT_PORT = new Set([
  "chile",
  "argentina",
  "arg",
  "mendoza",
  "brasil",
  "brazil",
  "peru",
  "colombia",
  "ecuador",
  "uruguay",
  "paraguay",
  "bolivia",
]);

export function isCountryNotPort(value: string): boolean {
  if (!value) return false;
  return COUNTRY_NOT_PORT.has(value.trim().toLowerCase());
}

// Subsequence-of-uppercase abbreviation matcher used to surface "WR" as a
// suggestion for "WENRAN", "VM" for "Van Moer", etc. Only triggers on short
// uppercase abbreviations (2-4 chars) that fit as an in-order subsequence
// of the full name. Restrictive on length to keep noise low.
export function isSubsequenceOfUppercase(short: string, long: string): boolean {
  if (!short || !long) return false;
  const s = short.trim().toUpperCase();
  const l = long.trim().toUpperCase();
  if (s.length < 2 || s.length > 4) return false;
  if (s.length >= l.length) return false;
  if (!/^[A-Z]+$/.test(s)) return false;
  let i = 0;
  for (const ch of l) {
    if (ch === s[i]) i++;
    if (i === s.length) return true;
  }
  return false;
}

// "Thermal Liner = USD 350" without a 20'/40' qualifier (CCL fixture case).
// Returns the unique value the caller should copy to both value20 and value40
// for the insulado_chile kind.
export function detectThermalLinerUnsized(text: string): number | null {
  if (!text) return null;
  const patterns = [
    /thermal\s+liner\s*=\s*usd\s*([\d.,]+)\b(?!\s*(?:20|40|chile|mendoza|argentina))/i,
    /thermoliner\s*=\s*usd\s*([\d.,]+)\b(?!\s*(?:20|40|chile|mendoza|argentina))/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const n = parseAmount(m[1]);
      if (n > 0) return n;
    }
  }
  return null;
}

// Identifies bundle inclusions ("includes flexitank, OF, EBS"). Returns the
// list of inclusion items when present, null otherwise. Used to keep SF as a
// single number (no splitting) and append "Incluye: ..." to rate notes.
export function detectBundleInclusions(text: string): string[] | null {
  if (!text) return null;
  const m = text.match(/\b(?:includes?|incluye|incluyen)\s+([^.;\n]+)/i);
  if (!m) return null;
  const list = (m[1] ?? "")
    .split(/,|\sand\s|\sy\s|\+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

// Heuristic detector for LCL sheets — they get skipped silently by the
// extractor. Indicators: "Insulation Chile/Argentina" headers, "per pallet/M3"
// in amount columns, and the absence of a clear POL+POD+Type header triple.
export function isLclSheet(sheetText: string): boolean {
  const t = sheetText ?? "";
  if (!t) return false;
  const indicators = [
    /insulation\s+(chile|argentina)/i,
    /per\s+(pallet|m3|m\^3|shipment)/i,
  ];
  const hits = indicators.filter((r) => r.test(t)).length;
  const hasTriple =
    /\bpol\b/i.test(t) && /\bpod\b/i.test(t) && /(type|equipment)/i.test(t);
  return hits >= 1 && !hasTriple;
}

// When a kind's value_unique was extracted but its KindDef says by_size=true,
// copy that single value into both value20 and value40 (the CCL "Thermal Liner
// = USD 350" case). Mutates kv in place and returns it.
export function copyUniqueToBothSizes(kv: KindValue, def: KindDef): KindValue {
  if (!def.by_size) return kv;
  if (kv.value_unique === undefined) return kv;
  if (kv.value20 === undefined) kv.value20 = kv.value_unique;
  if (kv.value40 === undefined) kv.value40 = kv.value_unique;
  delete kv.value_unique;
  return kv;
}

// Migrates one legacy rate record (834ad41 schema or older single-thermal
// shape) onto the v3 schema. Idempotent: rates already in v3 shape pass
// through with their kind_values/kinds preserved.
export function migrateRateV3(legacy: Rate | Record<string, unknown>): Rate {
  const r = legacy as Rate;
  const tipoMig = migrateContainerType(String(r.tipo ?? "20'"));

  // Build/refresh kind_values + kinds from whichever legacy shape we find.
  const kind_values: KindValue[] = [];
  const kinds: KindDef[] = [];

  // Already v3? Trust it but ensure the type literal is canonical.
  if (Array.isArray(r.kind_values) && Array.isArray(r.kinds)) {
    for (const k of r.kinds) kinds.push({ ...k });
    for (const kv of r.kind_values) kind_values.push({ ...kv });
  } else if (Array.isArray(r.additionalCosts)) {
    // Path A: 834ad41 dynamic costs
    const byKindId = new Map<string, KindValue>();
    for (const c of r.additionalCosts) {
      const mappedId = LEGACY_KIND_MAP[c.kind];
      let kindId: string;
      let def: KindDef;
      if (!mappedId) {
        // c.kind === "other" or unknown
        kindId = "custom_" + slugifyKindLabel(c.label || "misc");
        def = {
          id: kindId,
          label: c.label || "Otro",
          scope:
            c.applies === "reefer" ? "reefer" : c.applies === "dry" ? "dry" : "all",
          by_size: c.applies === "20" || c.applies === "40",
          predefined: false,
        };
      } else {
        kindId = mappedId;
        const found = PREDEFINED_KINDS.find((k) => k.id === kindId);
        if (!found) continue;
        def = found;
      }
      if (!kinds.some((k) => k.id === kindId)) kinds.push(def);
      let kv = byKindId.get(kindId);
      if (!kv) {
        kv = { kind_id: kindId };
        byKindId.set(kindId, kv);
        kind_values.push(kv);
      }
      if (c.applies === "20") kv.value20 = c.value;
      else if (c.applies === "40") kv.value40 = c.value;
      else kv.value_unique = c.value;
    }
  } else {
    // Path B: oldest legacy fixed-shape fields
    const addByKey = (
      kindId: string,
      field: "value20" | "value40" | "value_unique",
      value: number
    ) => {
      if (!value) return;
      const def = PREDEFINED_KINDS.find((k) => k.id === kindId);
      if (!def) return;
      if (!kinds.some((k) => k.id === kindId)) kinds.push(def);
      let kv = kind_values.find((k) => k.kind_id === kindId);
      if (!kv) {
        kv = { kind_id: kindId };
        kind_values.push(kv);
      }
      kv[field] = value;
    };
    addByKey("insulado_chile", "value20", r.thermalLinerChile20 ?? r.thermalLiner20 ?? 0);
    addByKey("insulado_chile", "value40", r.thermalLinerChile40 ?? r.thermalLiner40 ?? 0);
    addByKey("insulado_arg", "value20", r.thermalLinerMendoza20 ?? 0);
    addByKey("insulado_arg", "value40", r.thermalLinerMendoza40 ?? 0);
    addByKey(
      "precarriage_mendoza",
      "value20",
      r.fcaHaulageMendoza20 ?? r.fcaHaulage20 ?? 0
    );
    addByKey(
      "precarriage_mendoza",
      "value40",
      r.fcaHaulageMendoza40 ?? r.fcaHaulage40 ?? 0
    );
    addByKey("flexitank_arg", "value_unique", r.flexiArg ?? 0);
    addByKey("agency_fee", "value_unique", r.af ?? 0);
    addByKey("agency_fee_max", "value_unique", r.afMax ?? 0);
    addByKey("discount_insulated", "value_unique", r.discountInsulated ?? 0);
  }

  const baseNotes = (r.notes ?? r.notas ?? "").toString();
  const mergedNotes = tipoMig.note
    ? baseNotes
      ? `${baseNotes}\n${tipoMig.note}`
      : tipoMig.note
    : baseNotes;

  return {
    ...r,
    tipo: tipoMig.tipo,
    kind_values,
    kinds,
    notes: mergedNotes,
    notas: mergedNotes,
  };
}

// Backwards-compatible alias. Older call sites import normalizeRate; they now
// run the v3 migration which is a strict superset of the prior normalization.
export const normalizeRate = migrateRateV3;

// Migrates the localStorage rates blob from v2 (834ad41) to v3 ONCE per
// browser. Runs synchronously at module load so useLocalStore's first read of
// RATES_STORAGE_KEY (= "it_rates_v3") sees the migrated data. Idempotent: a
// flag in localStorage prevents re-running, even across different module
// imports within the same SPA navigation.
let _migrationDone = false;
function ensureRateMigration(): void {
  if (_migrationDone) return;
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(RATE_MIGRATION_FLAG) === "true") {
      _migrationDone = true;
      return;
    }
    const v2raw = window.localStorage.getItem(RATES_STORAGE_KEY_V2);
    if (v2raw) {
      // Snapshot the pre-migration data so a manual rollback is possible if
      // something downstream goes wrong with the new schema.
      window.localStorage.setItem(RATES_STORAGE_KEY_V2_BACKUP, v2raw);
      try {
        const parsed = JSON.parse(v2raw) as unknown[];
        if (Array.isArray(parsed)) {
          const migrated = parsed.map((r) =>
            migrateRateV3(r as Record<string, unknown>)
          );
          window.localStorage.setItem(
            RATES_STORAGE_KEY,
            JSON.stringify(migrated)
          );
        }
      } catch {
        // Bad parse — leave the backup in place and continue; the user can
        // recover manually if needed.
      }
    }
    window.localStorage.setItem(RATE_MIGRATION_FLAG, "true");
  } catch {
    // localStorage disabled or quota — silently skip; the in-memory migration
    // applied by migrateRateV3 at read time still keeps things working.
  } finally {
    _migrationDone = true;
  }
}

if (typeof window !== "undefined") {
  ensureRateMigration();
}

// v3.2 migration — stamps Rate.incoterm on records that pre-date the
// field. Idempotent: backed by RATE_MIGRATION_FLAG_V32 so it runs once
// per browser. On a fresh wipe (it_rates_v3 = []) this just sets the
// flag and returns; new rates created post-wipe get incoterm at
// extraction time and don't need migration.
export function migrateRateV32(rate: Rate): Rate {
  if (rate.incoterm) return rate;
  return {
    ...rate,
    incoterm: inferIncotermFromContext({
      pol: rate.pol,
      notas: rate.notas ?? rate.notes ?? "",
    }),
  };
}

let _migrationV32Done = false;
function ensureRateMigrationV32(): void {
  if (_migrationV32Done) return;
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(RATE_MIGRATION_FLAG_V32) === "true") {
      _migrationV32Done = true;
      return;
    }
    const v3raw = window.localStorage.getItem(RATES_STORAGE_KEY);
    if (v3raw) {
      window.localStorage.setItem(RATES_STORAGE_KEY_V32_BACKUP, v3raw);
      try {
        const parsed = JSON.parse(v3raw) as unknown[];
        if (Array.isArray(parsed)) {
          const migrated = parsed.map((r) =>
            migrateRateV32(r as Rate)
          );
          window.localStorage.setItem(
            RATES_STORAGE_KEY,
            JSON.stringify(migrated)
          );
        }
      } catch {
        // bad parse — backup stays, flag still gets set so we don't loop
      }
    }
    window.localStorage.setItem(RATE_MIGRATION_FLAG_V32, "true");
  } catch {
    // localStorage disabled / quota — skip silently
  } finally {
    _migrationV32Done = true;
  }
}

if (typeof window !== "undefined") {
  ensureRateMigrationV32();
}

// Inherit POD on FCA / EXW rate rows from the batch's unique maritime
// POD when it exists. Inter-Tank emails sometimes list the FCA Mendoza
// rate without an explicit POD because the batch's other rate rows
// already establish the destination port (Valle Redondo: 6 FOB
// Manzanillo + 2 FCA Mendoza, the FCA rates inherit "Manzanillo"
// silently). When the batch has multiple distinct PODs across maritime
// rates, no inheritance happens and the FCA row stays POD-empty so the
// pod_missing block fires.
export function inheritPodForFcaRates<
  T extends { pol?: string; pod?: string; notas?: string }
>(rates: T[]): T[] {
  const isFcaOrExw = (pol: string) =>
    /^(?:FCA|EXW)\b/i.test(pol) || isArgPol(pol);
  const maritimePods = new Set<string>();
  for (const r of rates) {
    const pol = (r.pol ?? "").trim();
    const pod = (r.pod ?? "").trim();
    if (isFcaOrExw(pol)) continue;
    if (pod) maritimePods.add(pod);
  }
  if (maritimePods.size !== 1) return rates;
  const inheritedPod = Array.from(maritimePods)[0]!;
  return rates.map((r) => {
    const pol = (r.pol ?? "").trim();
    const pod = (r.pod ?? "").trim();
    if (!isFcaOrExw(pol)) return r;
    if (pod) return r;
    const baseNotas = r.notas ?? "";
    const heritageNote = "POD heredado del batch";
    const newNotas = baseNotas
      ? baseNotas.includes(heritageNote)
        ? baseNotas
        : `${baseNotas}\n${heritageNote}`
      : heritageNote;
    return { ...r, pod: inheritedPod, notas: newNotas };
  });
}

// True if a rate has a 20'/40' cost of the given kind. Convenience for
// invoicing logic that needs to fish out a specific value.
export function findRateCost(
  rate: Rate,
  kind: AdditionalCostKind,
  applies: AppliesTo
): number {
  const list = rate.additionalCosts ?? [];
  const match = list.find(
    (c) => c.kind === kind && (c.applies === applies || c.applies === "all")
  );
  return match?.value ?? 0;
}

// Looks up an existing rate's agent name (and any rate's agent name in the
// catalog) by similarity to a candidate string. Reuses the same name-canon
// + Levenshtein machinery as findSimilarClient. Threshold is shared.
//
// Returns:
//   exactMatch: an agent name that already exists case-insensitively
//   similar:    distinct agent names with similarity >= 0.75 (sorted desc)
//
// "Distinct" means we dedupe within the catalog before scoring — agent names
// repeat heavily across rates, so passing a Rate[] would otherwise produce
// noisy duplicates.
export function findSimilarAgent(
  name: string,
  rates: Rate[]
): { exactMatch: string | null; similar: string[] } {
  const candidate = name.trim().toLowerCase();
  if (!candidate) return { exactMatch: null, similar: [] };
  // Build a unique catalog of agent names, preserving the original casing
  // of the first occurrence for display.
  const display = new Map<string, string>();
  for (const r of rates) {
    const a = r.agent.trim();
    if (!a) continue;
    const key = a.toLowerCase();
    if (!display.has(key)) display.set(key, a);
  }
  if (display.has(candidate)) {
    return { exactMatch: display.get(candidate)!, similar: [] };
  }
  const scored: Array<{ name: string; score: number }> = [];
  for (const [, displayName] of display) {
    const s = argClientNameSimilarity(name, displayName);
    if (s >= 0.75) scored.push({ name: displayName, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  return { exactMatch: null, similar: scored.map((s) => s.name) };
}

// Hardcoded shorthand → canonical agent name table. The catalog grows when
// the operations team confirms that two strings refer to the same agent.
// Lookup is case-insensitive (the resolver upper-cases the input). Adding a
// new pair consolidates pending-Q computations and prevents duplicate agent
// folders in localStorage.
export const AGENT_ALIASES: Record<string, string> = {
  WR: "WENRAN",
  BLG: "BALGUERIE",
  KTK: "KATAOKA",
  VM: "Van Moer",
  VR: "Valle Redondo",
};

// Standard Levenshtein edit distance with a small early-exit when the
// length delta already exceeds the cap. Used by resolveAgentCanonical to
// bridge typos like "Wenrn" → "WENRAN" without introducing an alias.
// (Suffix `Capped` because constants.ts already has a private uncapped
// `levenshtein` for argClient name similarity scoring.)
export function levenshteinCapped(a: string, b: string, cap = 6): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,         // deletion
        curr[j - 1] + 1,      // insertion
        prev[j - 1] + cost    // substitution
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > cap) return cap + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export type AgentResolution = {
  canonical: string;
  source: "alias" | "exact" | "levenshtein";
  confidence: number;
  distance?: number;
};

// Resolves a free-form agent input to the canonical name already in the
// catalog (or in AGENT_ALIASES). Three escalating sources:
//   - "alias"      → AGENT_ALIASES match (hardcoded shorthand)
//   - "exact"      → case-insensitive direct hit on a known agent
//   - "levenshtein"→ edit distance ≤ 2 against any known agent (typo bridge)
// Returns null when the input is genuinely a new agent — the caller then
// proceeds without prompting.
export function resolveAgentCanonical(
  input: string,
  knownAgents: ReadonlyArray<string>
): AgentResolution | null {
  const normalized = input.trim();
  if (!normalized) return null;
  const upper = normalized.toUpperCase();
  const aliasHit = AGENT_ALIASES[upper];
  if (aliasHit) {
    return { canonical: aliasHit, source: "alias", confidence: 1 };
  }
  const lower = normalized.toLowerCase();
  for (const known of knownAgents) {
    if (known.trim().toLowerCase() === lower) {
      return { canonical: known.trim(), source: "exact", confidence: 1 };
    }
  }
  let best: { canonical: string; distance: number } | null = null;
  for (const known of knownAgents) {
    const cand = known.trim();
    if (!cand) continue;
    const d = levenshteinCapped(lower, cand.toLowerCase(), 2);
    if (d <= 2 && (!best || d < best.distance)) {
      best = { canonical: cand, distance: d };
    }
  }
  if (best) {
    return {
      canonical: best.canonical,
      source: "levenshtein",
      confidence: 0.8,
      distance: best.distance,
    };
  }
  return null;
}

// Returns the canonical agent for a free-form name when the resolver finds
// one, or the trimmed input otherwise. Used by computePendingAgents to
// dedupe alias variants when listing known agents.
export function canonicalizeAgentName(
  input: string,
  knownAgents: ReadonlyArray<string>
): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  const upper = trimmed.toUpperCase();
  if (AGENT_ALIASES[upper]) return AGENT_ALIASES[upper];
  const resolved = resolveAgentCanonical(trimmed, knownAgents);
  if (resolved && resolved.source !== "levenshtein") return resolved.canonical;
  return trimmed;
}

// Derives a quarter label ("Q2 2026") from a (validFrom, validTo) pair when
// the dates land exactly on quarter boundaries. Falls back to a literal
// dd/mm/yyyy – dd/mm/yyyy range when the dates don't match a single quarter
// (cross-quarter spans, partial months, etc.). Used by computePendingAgents
// to label "último Q cargado" in the badge dropdown.
export function deriveQuarterFromDates(
  validFrom: string | null | undefined,
  validTo: string | null | undefined
): string {
  const from = (validFrom ?? "").trim();
  const to = (validTo ?? "").trim();
  if (!from || !to) return "Sin tarifas previas";
  const fromMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
  const toMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to);
  if (fromMatch && toMatch && fromMatch[1] === toMatch[1]) {
    const year = fromMatch[1]!;
    const fmonth = parseInt(fromMatch[2]!, 10);
    const fday = parseInt(fromMatch[3]!, 10);
    const tmonth = parseInt(toMatch[2]!, 10);
    const tday = parseInt(toMatch[3]!, 10);
    for (const q of QUARTER_ORDER) {
      const range = QUARTER_RANGES[q];
      if (
        fmonth === range.startMonth &&
        fday === range.startDay &&
        tmonth === range.endMonth &&
        tday === range.endDay
      ) {
        return `${q} ${year}`;
      }
    }
  }
  return `${formatDateCl(from)} – ${formatDateCl(to)}`;
}

export type PendingAgent = {
  agent: string;
  lastQuarterLabel: string;
  lastValidTo: string | null;
  rateCount: number;
};

// Computes the list of agents that have rates in the catalog but NONE that
// fall inside the selected quarters' date range. Alias-canonicalises agent
// names so "WR" + "WENRAN" collapse to a single entry. Sorted by oldest
// last-validTo first (most stale → most pressing follow-up). Agents that
// never had a rate in the past also appear with lastValidTo=null.
export function computePendingAgents(
  rates: ReadonlyArray<Rate>,
  selectedYear: number,
  picked: Set<Quarter>
): PendingAgent[] {
  const range = quartersToDateRange(selectedYear, picked);
  if (!range) return [];
  // Group rates by canonical agent name. The grouping uses the resolver's
  // "alias" / "exact" sources only; Levenshtein matches are intentionally
  // skipped here because we don't want a typo'd entry to silently fold
  // into a different agent's bucket without user confirmation.
  const display = new Map<string, string>();
  for (const r of rates) {
    const a = r.agent.trim();
    if (!a) continue;
    const upper = a.toUpperCase();
    const canonical = AGENT_ALIASES[upper] ?? a;
    const key = canonical.toLowerCase();
    if (!display.has(key)) display.set(key, canonical);
  }
  const grouped = new Map<string, Rate[]>();
  for (const r of rates) {
    const a = r.agent.trim();
    if (!a) continue;
    const upper = a.toUpperCase();
    const canonical = AGENT_ALIASES[upper] ?? a;
    const key = canonical.toLowerCase();
    const list = grouped.get(key) ?? [];
    list.push(r);
    grouped.set(key, list);
  }
  const pending: PendingAgent[] = [];
  for (const [key, agentRates] of grouped) {
    const hasInQ = agentRates.some((r) => {
      const from = (r.validFrom ?? "").trim();
      const to = (r.validTo ?? "").trim();
      if (!from && !to) return false;
      // Overlap test: rate's [from..to] intersects the picked range.
      const rateFrom = from || range.validFrom;
      const rateTo = to || range.validTo;
      return rateFrom <= range.validTo && rateTo >= range.validFrom;
    });
    if (hasInQ) continue;
    // Pick the most recent rate by validTo for the "último Q cargado"
    // label. Rates without a validTo land at the bottom of the sort.
    const sorted = agentRates.slice().sort((a, b) => {
      const aTo = (a.validTo ?? "").trim();
      const bTo = (b.validTo ?? "").trim();
      return bTo.localeCompare(aTo);
    });
    const last = sorted[0];
    const lastValidTo = (last?.validTo ?? "").trim() || null;
    const lastQuarterLabel = lastValidTo
      ? deriveQuarterFromDates(last?.validFrom ?? null, last?.validTo ?? null)
      : "Sin tarifas previas";
    pending.push({
      agent: display.get(key) ?? key,
      lastQuarterLabel,
      lastValidTo,
      rateCount: agentRates.length,
    });
  }
  // Oldest first (most stale at the top). Agents with no validTo go to the
  // very top — they're the most overdue.
  pending.sort((a, b) => {
    if (!a.lastValidTo && !b.lastValidTo) return a.agent.localeCompare(b.agent);
    if (!a.lastValidTo) return -1;
    if (!b.lastValidTo) return 1;
    return a.lastValidTo.localeCompare(b.lastValidTo);
  });
  return pending;
}

// Quarter helpers. Q1 = 01/01–31/03, Q2 = 01/04–30/06, etc. When the user
// picks multiple consecutive quarters we span from the first quarter's start
// to the last quarter's end.
export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

export const QUARTER_RANGES: Record<
  Quarter,
  { startMonth: number; startDay: number; endMonth: number; endDay: number }
> = {
  Q1: { startMonth: 1, startDay: 1, endMonth: 3, endDay: 31 },
  Q2: { startMonth: 4, startDay: 1, endMonth: 6, endDay: 30 },
  Q3: { startMonth: 7, startDay: 1, endMonth: 9, endDay: 30 },
  Q4: { startMonth: 10, startDay: 1, endMonth: 12, endDay: 31 },
};

const QUARTER_ORDER: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Resolves a year + chosen quarters to an ISO date range. If multiple quarters
// are picked, the range spans from the earliest quarter's start to the latest
// quarter's end — works whether they're contiguous or not.
export function quartersToDateRange(
  year: number,
  picked: Set<Quarter>
): { validFrom: string; validTo: string } | null {
  if (!year || picked.size === 0) return null;
  const ordered = QUARTER_ORDER.filter((q) => picked.has(q));
  if (ordered.length === 0) return null;
  const first = QUARTER_RANGES[ordered[0]!];
  const last = QUARTER_RANGES[ordered[ordered.length - 1]!];
  return {
    validFrom: `${year}-${pad(first.startMonth)}-${pad(first.startDay)}`,
    validTo: `${year}-${pad(last.endMonth)}-${pad(last.endDay)}`,
  };
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
    tipo: "20'Flexi",
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
    tipo: "40'Dry",
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
    tipo: "20'Flexi",
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
    tipo: "40'Dry",
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
    tipo: "20'Flexi",
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
    tipo: "40'Dry",
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
    tipo: "40'Dry",
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
    tipo: "40'Dry",
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
    tipo: "40'Dry",
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
    tipo: "20'Flexi",
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
    tipo: "20'Dry",
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

// Detects when a (validFrom, validTo) ISO range coincides exactly with one
// of the four calendar quarters of a year and returns "Q2 2026" or
// similar. Falls back to "dd/mm/yyyy – dd/mm/yyyy" when the range doesn't
// align to a quarter boundary. Returns empty string when either side is
// missing — caller decides whether to render a pill or skip.
export function formatBatchVigencia(
  validFrom: string | null | undefined,
  validTo: string | null | undefined
): string {
  const from = (validFrom ?? "").trim();
  const to = (validTo ?? "").trim();
  if (!from || !to) return "";
  const isoFrom = from.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const isoTo = to.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoFrom && isoTo) {
    const yearFrom = isoFrom[1];
    const yearTo = isoTo[1];
    if (yearFrom === yearTo) {
      const fromKey = `${isoFrom[1]}-${isoFrom[2]!.padStart(2, "0")}-${isoFrom[3]!.padStart(2, "0")}`;
      const toKey = `${isoTo[1]}-${isoTo[2]!.padStart(2, "0")}-${isoTo[3]!.padStart(2, "0")}`;
      const QUARTERS: Record<string, [string, string]> = {
        Q1: [`${yearFrom}-01-01`, `${yearFrom}-03-31`],
        Q2: [`${yearFrom}-04-01`, `${yearFrom}-06-30`],
        Q3: [`${yearFrom}-07-01`, `${yearFrom}-09-30`],
        Q4: [`${yearFrom}-10-01`, `${yearFrom}-12-31`],
      };
      for (const [q, [qFrom, qTo]] of Object.entries(QUARTERS)) {
        if (fromKey === qFrom && toKey === qTo) {
          return `${q} ${yearFrom}`;
        }
      }
    }
  }
  return `${formatDateCl(from)} – ${formatDateCl(to)}`;
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
// "CMA-CGM" must equal "CMA CGM" must equal "cma-cgm". Also matches via
// alias resolution so "EVER" === "Evergreen" — the rate keeps "EVER" on
// disk but the matcher treats the two as the same carrier.
function normalizeCarrier(c: string): string {
  return c.toLowerCase().replace(/[\s-]+/g, "");
}

export function carriersMatch(a: string, b: string): boolean {
  if (normalizeCarrier(a) === normalizeCarrier(b)) return true;
  const ca = resolveCarrierCanonical(a);
  const cb = resolveCarrierCanonical(b);
  if (ca === a && cb === b) return false; // neither resolved — already known unequal
  return normalizeCarrier(ca) === normalizeCarrier(cb);
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
  // Uppercase-abbreviation subsequence match: "WR" → "WENRAN", "VM" →
  // "Van Moer". Only fires on short (2-4 char) all-uppercase abbreviations
  // that fit as an in-order subsequence of the full name (or vice versa).
  if (isSubsequenceOfUppercase(a, b) || isSubsequenceOfUppercase(b, a)) {
    return 0.85;
  }
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
