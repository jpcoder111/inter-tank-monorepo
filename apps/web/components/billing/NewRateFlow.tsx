"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/Button";
import { useLocalStore } from "./useLocalStore";
import { ComercialBadge } from "./EntitiesTab";
import {
  AGENT_SUGGESTIONS,
  CARRIER_SUGGESTIONS,
  CONTAINER_TYPES,
  ContainerType,
  KIND_ALIASES,
  KindDef,
  KindScope,
  KindValue,
  PREDEFINED_KINDS,
  ComercialName,
  COMERCIALES,
  COMERCIAL_COLORS,
  ENTITIES_SEED,
  ENTITIES_STORAGE_KEY,
  Entity,
  PendingAgentEntity,
  Quarter,
  Rate,
  carrierColor,
  computePendingAgentsFromCatalog,
  findEntityByAgentName,
  resolvePodCanonical,
  consolidatePreferentialNotes,
  detectAgencyFee,
  detectAgencyFeeMax,
  detectBundleInclusions,
  detectDisposal,
  detectDiscountInsulated,
  detectExcelBlockKinds,
  detectExcludedKindsFromText,
  detectPrecarriageInline,
  detectRegionalAddons,
  detectSubClientSuffixes,
  detectThermalLinerUnsized,
  type AgentResolution,
  resolveAgentCanonical,
  extractPreferentialClientsFromLabel,
  extractSizeFromKindLabel,
  filterBatchNotesText,
  findSimilarAgent,
  formatBatchVigencia,
  formatDateCl,
  formatRoute,
  inferIncotermFromContext,
  inheritPodForFcaRates,
  Incoterm,
  INCOTERM_OPTIONS,
  isAsianPod,
  isCountryNotPort,
  isDateInPast,
  isLclSheet,
  isParsableNumber,
  isRateNeedsReview,
  isValidDate,
  matchKindByAlias,
  migrateContainerType,
  parseMultiCarrier,
  quartersToDateRange,
  RateRangeFlag,
  slugifyKindLabel,
  dedupeKindsAgainstPredefined,
  uniqueSuggestions,
  validateKindsValueUniqueness,
  validateRateRange,
} from "./constants";

// ============================================================================
// Pure extraction helpers (copied from RateIntake to avoid coupling — both
// flows share these conceptually but the file split is left for a follow-up
// cleanup commit). Any change here that affects extraction quality should
// also be applied to RateIntake.tsx.
// ============================================================================

const STRICT_RESPONSE_RULES_NO_LIMIT = `IMPORTANTE: Respondé SOLO con el JSON, sin backticks de markdown (\`\`\`), sin texto adicional antes o después.`;

const RATE_SYSTEM = `You are extracting shipping-rate data from a document (Excel/email/PDF/image).

OUTPUT: a single JSON object with this exact shape:
{
  "agent_inferred": string,
  "validity_inferred": { "from": string, "to": string } | null,
  "notas_globales": string,
  "rates": [
    {
      "carrier": string,
      "pol": string,
      "pod": string,
      "type": "20'Dry" | "40'Dry" | "40'Reefer" | "20'Flexi",
      "sl": string,
      "sf": number,
      "bl_fee": number,
      "validFrom": string | null,
      "validTo":   string | null,
      "kinds": [
        { "label": string, "value20": number | null, "value40": number | null, "value_unique": number | null }
      ],
      "notas": string
    }
  ]
}

TYPE FIELD — RULES:
Each rate row encodes ONE container size + ONE category in \`type\`:
  - "20'Dry"     → 20-foot dry container
  - "40'Dry"     → 40-foot dry container
  - "40'Reefer"  → 40-foot reefer (refrigerated)
  - "20'Flexi"   → 20-foot dry stuffed with flexitank
NEVER emit just "Dry" or "Reefer" without size. If a single source row presents
both sizes for the same lane (e.g. "20'Dry SF=1450 / 40'Dry SF=1600"), emit
TWO rate rows — one per size — sharing pol/pod/sl/carrier/kinds. If size is
genuinely ambiguous, default to "20'Dry" and append to \`notas\`:
"Tamaño no especificado, asumido 20'."

RATE-ROW GATE (apply this first, before any other rule): A line is a rate row IF AND ONLY IF BOTH conditions hold:
   (a) After trimming leading whitespace, the line STARTS with one of these triggers (case-insensitive):
       Rate words: "Rate" / "Rates" / "Tarifa" / "Tarifas".
       Incoterms:  "FOB" / "CIF" / "CFR" / "FCA" / "EXW".
   (b) The line contains "=" or ":" with a USD/$/numeric value AFTER the separator.
   Lines that do NOT start with one of those triggers are NEVER rate rows even when they contain the word "rate" mid-sentence. They go to kinds[] (per rule 2) or are ignored entirely.
   Examples — RATE rows (matched by START prefix):
     - "Rate 20 OOCL = USD 580 + USD 40xbl + EBS"        → rate row (starts "Rate").
     - "Rate 40 RF Hapag = USD 4500"                      → rate row.
     - "Tarifa 20 FOB Manzanillo Flexi = USD 890"         → rate row.
     - "FOB San Antonio - Grangemouth 20' Hapag: US$1600" → rate row (starts "FOB").
     - "FCA Santa Rita - Rotterdam port: US$ 2905"        → rate row.
     - "EXW Bodega Sophenia = USD 4500"                   → rate row.
     - "CIF Antwerp = USD 1850"                           → rate row.
   Examples — NOT rate rows (start with non-trigger):
     - "Inland rate for 40 FCA Mendoza ... = USD 2270"    → starts "Inland", NOT a rate. (precarriage kind, handled client-side.)
     - "Inland FCA Mendoza 20 = USD 2250"                 → starts "Inland".
     - "FCA Haulage Mendoza to Chile = USD 2170"          → starts "FCA Haulage", treated as precarriage kind, NOT a rate. (See note: client preprocesses these before you see them, but if any leak through, do NOT emit as rate.)
     - "Flexitank Chile = USD 600"                        → starts "Flexitank" → kind (flexitank_chile).
     - "Thermal Liner = USD 350"                          → starts "Thermal" → kind (insulado_*).
     - "Agentfee Chile = USD 75"                          → starts "Agentfee" → kind.
     - "Carrier OOCL or CMA"                              → starts "Carrier" → metadata, ignore.
     - "Additional Rivadavia = USD 100"                   → starts "Additional" → notas_globales (regional add-on).
     - "Hi Chris,"                                        → starts "Hi" → ignore.
     - "Validity 30/6"                                    → starts "Validity" → ignore.
     - "14 free days destination"                         → starts with a digit → notas_globales free-day line.
     - "Rates on the 20 feet + EBS"                       → starts "Rates" but no "=" with value → ignore.

HARD RULES:
1. EBS / EFS / BAF / Emergency Bunker Surcharge are ALWAYS billed separately via Inter-Tank's EBS table. NEVER include them in sf and DO NOT emit any note about them — drop silently. "USD 1450 + USD 60 BL Fee + EBS USD 75" → sf=1450, bl_fee=60. The mention is noise to ignore.
2. The following items are CHARGES (kinds), NEVER rate rows. Emit them only in the rate's kinds[] field; do NOT also emit them as entries in rates[]:
   - Thermal Liner / Thermo Liner / Insulado / Discount Insulated
   - Flexitank Chile / Flexitank Argentina / Flexibag / S&F (Stuffing) Chile or Argentina / LAF Mendoza
   - Inland / Precarriage / Haulage Mendoza / "FCA <city>" when used as a standalone catalog line (e.g. "Inland FCA Mendoza 20 = USD 2250") — that is a charge, not a transport rate
   - Agency Fee / Agency Fee Max / Agentfee
   - Disposal / Disposal flexibag / Cargo disposal
   When the SAME source line appears as both a kind AND something that looks like a rate row (e.g. "Flexitank Chile = USD 600"), emit it ONLY as a kind. Do NOT duplicate as a rate. Note: 40'Reefer is a refrigerated container TYPE (rate row valid); the items above are surcharges or charges, not transport.
3. CONTAINER TYPE detection — there are exactly 4 valid Inter-Tank types: "20'Dry", "20'Flexi", "40'Dry", "40'Reefer". The frontend will REJECT anything else.
   - DEFAULT: Dry. Pick "20'Dry" or "40'Dry" based on the size mentioned in the rate.
   - REEFER (Reefer / RF / Refrigerada / Refrigerated container): pick "40'Reefer". 20-foot reefers do NOT exist in this catalog — if the source says "20'Reefer" or "Reefer 20", emit "20'Dry" anyway and the frontend will flag it for the user to fix.
   - FLEXI (Flexi / Flexitank / Flexibag): pick "20'Flexi". 40-foot flexis do NOT exist — if the source says "40'Flexi" or "Flexi 40", emit "40'Dry" and the frontend will flag.
   - Thermal Liner / Thermo Liner / Liner / Insulado are NOT a container type — they're a kind (insulado_chile / insulado_arg). Emit them in kinds[], not as a rate row's tipo.
   - COMMODITIES (Wine, Juice, Nueces, Frozen, Fresh, Vegetables, Bottled, Hazardous, etc.) NEVER determine type. They are descriptors, not container types and not kinds. Ignore them when picking tipo. Group headers like "Wine/Juice loads:", "Dry loads:", "Reefer loads:" introduce rate groups — they're NOT charges and NOT rate rows themselves; emit only the actual rates that follow such a header.
4. Multi-carrier on one row ("OOCL or CMA", "OOCL/EVER", "Carriers: OOCL, EVER"): set sl="OOCL or CMA". DO NOT clone — frontend clones.
5. Bundle "includes X, Y, Z" / "incluye X, Y, Z": keep sf as ONE number (do not split). Add to notas: "Incluye: <list>". Do NOT invent kinds for the inclusions.
6. Per-row validity is IGNORED by design. Inter-Tank rates always inherit validity from the batch (Step 1's Q1/Q2/Q3/Q4 picker or date range). Do NOT emit validFrom / validTo per rate even when the source mentions "Validity 30/6" / "valid until X" / a different per-row date. If a row legitimately has different validity, the user's workflow is to create a separate batch. Leave validFrom / validTo OUT of each rate row — only use validity_inferred at the batch level for the overall file's validity hint.
7. Regional add-ons (San Carlos, Tupungato, Rivadavia, San Juan, San Martín, "afuera de Mendoza", "Add" or "Additional" lines): NEVER as a rate row. Append to notas_globales.
8. Free-day info: notas_globales.
8b. notas_globales is a STRICT operational field. It contains ONLY:
    - Free-day info (e.g. "14 free days destination", "14/8 free days at origin/destination").
    - Regional add-ons that affect every rate of the batch.
    - Sub-client values for predefined kinds (Fix 4 case WENRAN — those are produced client-side; you don't need to emit them).
    Anything else MUST be left out. NEVER include in notas_globales:
    - Saludos / despedidas: "Hi Chris", "Best regards", "Cheers", "Hello team".
    - Comentarios narrativos: "diesel rose 50%", "ME war", "due to fuel increase", "varies per line", "expires march 31st", "subject to changes in bunker", "now USD 256 per 40".
    - Promesas comerciales: "we are happy to confirm", "sadly we need to increase", "took time but got partial good news".
    - Validity / expires (already captured by validity_inferred): "Validity 30/6", "Validez fin de junio", "expires march 31st".
    - EBS / EFS / BAF / Bunker Surcharge / BL Fee mentions of any kind — they have their own dedicated handling.
    - Section / group headers: "FOB Chile:", "FCA ARG", "Wine/Juice loads:", "MSC", "CMA-CGM", "Reefer loads:".
    - Carrier listings as plain assignments: "Carrier OOCL or CMA" — that goes to the rate's sl field, never to notas_globales.
    When in doubt, LEAVE IT OUT. The textarea defaults to empty for a reason.
9. LCL content: skip entirely. Indicators: "Insulation Chile/Argentina" headers, amounts "per pallet/M3/shipment", early "OF" column, no clear POL+POD+Type triple.
10. Date formats accepted: dd/mm/yyyy, dd/mm (no year — frontend assumes the batch year), "Fin de Junio"/"end of June" (last day of month), "March 31st", "Q2 2026", Excel datetimes. Emit dd/mm/yyyy when possible, else the original token.
11. POL / POD extraction by context — Inter-Tank operates from Chile so POL is implicit (chilean) when only one port is mentioned. Apply these three sub-rules in order:

    A1. Single port WITHOUT a separator ("→", " - ", " to ") → that port is the POD. POL stays empty.
        - "Rate 40 FOB Manzanillo OOCL = USD 695"   → pol="", pod="Manzanillo"
        - "Tarifa 20 FOB Antwerp Hapag = USD 1600"  → pol="", pod="Antwerp"
        - "Rate 20 OOCL = USD 580" (no port)        → pol="", pod="" (the frontend flags pod_missing)

    A2. Two ports with a separator → first is POL, second is POD.
        - "FOB San Antonio - Grangemouth"      → pol="San Antonio", pod="Grangemouth"
        - "FCA Santa Rita - Rotterdam"         → pol="FCA Santa Rita", pod="Rotterdam"  (FCA prefix preserved on POL)
        - "From San Antonio to Antwerp"        → pol="San Antonio", pod="Antwerp"

    A3. FCA / EXW Argentine origin (Mendoza, Santa Rita, San Carlos, Tupungato, Rivadavia, San Juan, San Martín, Río Negro):
        - POL = "FCA <ciudad>" (or "EXW <ciudad>"), preserving the original capitalization.
        - POD = empty if not mentioned per-rate; the frontend's inheritPodForFcaRates step copies the batch's unique maritime POD when one exists.
        - "Tarifa FCA Mendoza Flexi = USD 3070" in a Manzanillo-batch → pol="FCA Mendoza", pod="" (frontend inherits "Manzanillo")
        - "Rate 40 FCA Santa Rita - Rotterdam" → pol="FCA Santa Rita", pod="Rotterdam" (literal both)

    Never write a country / region name alone (Chile / Argentina / Brasil / Mendoza-as-region) as POL or POD. If only the country is known, leave the field empty. Do NOT invent Valparaíso / Santos / etc.

12. Bundle inclusions (rule 5) preserve Incoterms LITERALLY: when the source says "FCA Santa Rita ... includes trucking, locales, flexitank, OF + EBS", emit notas like "Incluye: trucking en origen, gastos locales en origen, flexitank, ocean freight. FCA." Same for FOB / CFR / CIF. The Incoterm in the notas is the sentence-end stamp; the structured Incoterm field on the rate (rule 13) carries the canonical value.

13. EXTRACT INCOTERM — emit a literal "incoterm" field on every rate row using one of: "FCA", "EXW", "FOB", "CIF", "CFR", or the placeholder "FOB/CIF/CFR".

    The Incoterm keyword (FCA / EXW / FOB / CIF / CFR, case-insensitive) can appear anywhere in or near the rate line. Look for it in ALL these positions:
      (a) Standalone before a city: "Tarifa FCA Mendoza Flexi" → incoterm="FCA".
      (b) Modifier of POD: "Tarifa 20 FOB Manzanillo Flexi = USD 890" → incoterm="FOB". The keyword sits between size and port, but it's still the Incoterm.
      (c) Modifier of route: "Rate 40 FOB San Antonio - Grangemouth" → incoterm="FOB".
      (d) After size before port: "Rate 20 CIF Antwerp = USD 1500" → incoterm="CIF".
    Always emit the matched value uppercase. Match anywhere in the rate line — the Incoterm modifies the rate's commercial terms, not just the POL.

    GEOGRAPHIC FALLBACK: when no Incoterm word appears in the line AND POL matches an Argentine city (Mendoza, Santa Rita, San Carlos, Tupungato, Rivadavia, San Juan, San Martín, Río Negro), default incoterm="FCA".

    PLACEHOLDER "FOB/CIF/CFR" — use ONLY when both:
      - No FCA/EXW/FOB/CIF/CFR keyword anywhere in the line, AND
      - POL is empty or a Chilean port (San Antonio / Valparaíso / etc.)
    The placeholder represents a rate that resolves to one of FOB/CIF/CFR at billing time against the customer's quote sheet. NEVER use it when the line literally contains an Incoterm word.

    NEVER make up an Incoterm outside this six-value enum.

${STRICT_RESPONSE_RULES_NO_LIMIT}`;

const RATE_CHUNK_SYSTEM = `You are extracting shipping-rate rows from one chunk of an Excel sheet.

OUTPUT: a single JSON object:
{
  "rates": [
    {
      "carrier": string,
      "pol": string,
      "pod": string,
      "type": "20'Dry" | "40'Dry" | "40'Reefer" | "20'Flexi",
      "sl": string,
      "sf": number,
      "bl_fee": number,
      "validFrom": string | null,
      "validTo":   string | null,
      "kinds": [
        { "label": string, "value20": number | null, "value40": number | null, "value_unique": number | null }
      ],
      "notas": string
    }
  ]
}

(No agent_inferred / validity_inferred / notas_globales here — those come from the first chunk's preamble or from the user's Step 1 inputs.)

TYPE FIELD — RULES:
Each rate row encodes ONE container size + ONE category in \`type\`:
  - "20'Dry"     → 20-foot dry container
  - "40'Dry"     → 40-foot dry container
  - "40'Reefer"  → 40-foot reefer (refrigerated)
  - "20'Flexi"   → 20-foot dry stuffed with flexitank
NEVER emit just "Dry" or "Reefer" without size. Two-size rows split into two RateRows.

RATE-ROW GATE: this chunk is a tabular Excel slice where each non-header data row represents a rate by its column structure (POL + POD + Type + SF columns). The trigger-words gate ("Rate" / "Tarifa" required, used for free-text emails) is satisfied implicitly here — emit one rate per data row. The kinds-only categories from rule 2 still apply: any row whose values match a kind (Flexitank, Inland FCA Mendoza, Thermal Liner, Agency Fee, Disposal) does NOT become a rate row, even when it sits in the rate-table columns.

HARD RULES:
1. EBS / EFS / BAF / Emergency Bunker Surcharge are ALWAYS billed separately via Inter-Tank's EBS table. NEVER include them in sf and DO NOT emit notes about them — drop silently. "USD 1450 + USD 60 BL Fee + EBS USD 75" → sf=1450, bl_fee=60.
2. The following are CHARGES (kinds), NEVER rate rows: Thermal Liner / Insulado / Discount Insulated, Flexitank Chile / Argentina, Flexibag / S&F / LAF Mendoza, Inland / Precarriage / Haulage Mendoza / standalone "FCA <city>" charge lines, Agency Fee / Max, Disposal. Emit them in kinds[]. Never duplicate as rate rows in rates[].
3. Multi-carrier on one row: set sl="OOCL or CMA". DO NOT clone.
4. Bundle "includes X, Y, Z": keep sf as one number. Add "Incluye: <list>" to notas. Preserve FCA / FOB Incoterms at the end of the notas string when the source mentions them literally.
5. LCL rows: skip entirely.
6. Compound SF cells like "USD 2540 + USD 60 BL Fee" or "2540/60": parse first number as sf, second as bl_fee.
7. Any cell whose value reads "USD X per BL" / "USD X xbl" / "USD X / BL" / "USD X per bl" — regardless of column header — IS the rate's bl_fee. Example: a column "(Surcharge 1)" with value "USD 38 per bl" → bl_fee=38, NOT a kind. Multiple per-BL surcharges in the same row → sum them into bl_fee.
8. Columns labeled BAF / Bunker / Surcharge whose cell value is literally "Included" / "Incl." / "Bundled" / "N/A": these mean the surcharge is bundled into SF. DO NOT emit them as kinds and DO NOT use them as numeric values. Append to that rate's notas: "BAF/Bunker incluido en SF.".
9. Regional add-on rows like "Add San Carlos US$ 200 on top of Mendoza" → DO NOT emit them as a rate row. Skip; the frontend handles regional add-ons via a separate sweep.
10. Rows whose SF cell is blank / missing / "TBD" / "Ask agent" but the row otherwise has POL+POD+Type+SL filled → STILL emit them. Set sf to null (NOT 0). The frontend flags these for user review rather than letting them disappear silently. The same applies to expired-validity rows (datetime in the past) — emit them; the frontend annotates and flags.

7. EXTRACT INCOTERM — emit a literal "incoterm" on every rate row, one of "FCA" / "EXW" / "FOB" / "CIF" / "CFR" or the placeholder "FOB/CIF/CFR". The Incoterm keyword can appear anywhere in the row (column header, POL cell, dedicated Incoterm column, free text in a remarks column). Always pick the literal value (uppercase). When the row is on a sheet whose POL column shows an Argentine pickup city (Mendoza, Santa Rita, San Carlos, Tupungato, Rivadavia, San Juan, San Martín, Río Negro) and no explicit Incoterm word appears, default to "FCA". Otherwise default to "FOB/CIF/CFR". Never invent an Incoterm outside the six-value enum.

If the chunk is not a rate table, return { "rates": [] }.

${STRICT_RESPONSE_RULES_NO_LIMIT}`;

// Concise prompt for the second extraction pass: takes the right-side block
// of an Excel sheet (Items table, free-text discount, "Please note..." boxes)
// and returns ONLY the kinds + global notes. Routed to haiku via the API
// route's text-only model (route.ts: TEXT_MODEL = claude-haiku-4-5-20251001).
const KINDS_FROM_BLOCK_SYSTEM = `You extract charge/discount definitions from a free-form text block (Excel side block, item table, or notes section).

OUTPUT: a single JSON object:
{
  "kinds": [
    { "label": string, "value20": number | null, "value40": number | null, "value_unique": number | null }
  ],
  "notas_globales": string
}

A "kind" is a charge or discount that applies to rates: Insulado / Thermal Liner, Flexitank, Agency Fee, Agency Fee Max, Disposal, Discount Insulado, Precarriage, etc. Emit one entry per distinct kind.

EXPLICITLY EXCLUDED from kinds:
- EBS / EFS / BAF / Emergency Bunker Surcharge / Bunker Surcharge — Inter-Tank tracks these separately in its EBS table, never as a kind. Drop silently. Even when the source says "EBS USD 160 per teu" or "EBS 320", do NOT emit a kind for it.
- BL Fee / Bill of Lading Fee / Documentation Fee / Doc Fee — these are NATIVE Rate fields populated by the rate-extraction prompt (RATE_SYSTEM), not kinds. Do NOT emit them here.
Kinds come ONLY from the predefined catalog (flexitank_chile, flexitank_arg, insulado_chile, insulado_arg, precarriage_mendoza, disposal, agency_fee, agency_fee_max, discount_insulated) plus user-defined custom kinds for genuinely new domain concepts. Never EBS, never BL Fee.

RULES:
- Use value20 + value40 when the source distinguishes sizes; otherwise use value_unique.
- For discounts ("discount of USD 25 if insulated"), emit value_unique as a NEGATIVE number.
- "Thermal Liner = USD X" without size → value_unique: X. Frontend will copy to both 20' and 40'.
- Regional add-ons ("Add San Carlos US$ 200 on top of Mendoza") → notas_globales (the frontend's regex sweep also captures these). Free-day lines ("14 free days destination") → notas_globales. Sub-client suffix lines like "Thermal Liner Chile (ASC - Aussino - EMW) = 180/280" are handled client-side BEFORE this prompt sees the text — if any leak through, do NOT emit them as kinds, leave them in notas_globales as raw text.
- notas_globales is STRICTLY operational. Allowed: free days, regional add-ons, sub-client values, "afueras de <city>" notes. NEVER include: saludations ("Hi Chris", "Best regards"), narrative ("diesel rose", "varies per line", "subject to changes", "now USD 256 per 40"), validity ("Validity 30/6", "expires march 31st", "Fin de junio"), EBS/EFS/BAF/Bunker/BL Fee mentions, section headers ("FOB Chile:", "Wine/Juice loads:", "MSC"), carrier listings ("Carriers: OOCL, EVER"). When in doubt, leave notas_globales EMPTY.
- If a charge's value is literally "Included" / "Incl." / "Bundled" / "N/A" (no number), do NOT emit a kind for it — that means it's bundled. Mention in notas_globales if relevant ("BAF incluido en SF.").
- CONSOLIDATION: when the same charge appears across multiple rows split by container size (e.g. "FCA Mendoza | 20'Flexi | 2170", "FCA Mendoza | 20'DC | 2170", "FCA Mendoza | 40'DC | 2270"), emit ONE kind entry. Drop the size token from the label ("FCA Mendoza", not "FCA 40'DC Mendoza") and populate value20 / value40 from the size-tagged rows. When two size-20 rows give the same value, use it once.
- ADD-ONS: rows like "Add San Carlos US$ 200 on top of Mendoza" / "Additional Rivadavia US$ 100" are regional add-ons, NOT kinds. Skip them — frontend captures them via a regex sweep into notas_globales.
- DESCRIPTOR LABELS: lines like "Wine/Juice loads", "Dry loads", "Reefer loads", "Cargo type X" are categorization headers used by some agents to separate rate groups, NOT charges. NEVER emit them as kinds. They have no SF / no value of their own.
- THERMAL LINER vs REEFER: a 40'Reefer is a refrigerated container (rate-row type). Thermal Liner / Insulado is an insulating kit installed in a Dry container (charge / kind only). Never emit Thermal Liner as a rate — only as a kind.
- If nothing recognizable, return { "kinds": [], "notas_globales": "" }.

${STRICT_RESPONSE_RULES_NO_LIMIT}`;

const EXCEL_MAX_ROWS = 150;
const EXCEL_MAX_CHARS = 15000;
const CHUNK_DATA_ROWS = 15;
const MAX_CHUNK_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;
const LARGE_FILE_BYTES = 10 * 1024 * 1024;
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type SheetClassification = "rate" | "catalog" | "lcl";

type ExcelReadResult = {
  // CSV-like text built from "rate"-classified sheets only. Catalog and LCL
  // sheets are filtered out at read time so they don't pollute the chunked
  // rate prompt with non-rate content.
  text: string;
  // Combined text fed to the kinds-extraction pass: catalog sheets in full
  // PLUS the right-side blocks of rate sheets (the column slice past the
  // first fully-empty separator column). Both are kinds-bearing content
  // that doesn't belong in the rate prompt.
  kindsBlock: string;
  // Per-sheet classification, surfaced for logging in the dev console so
  // it's easy to confirm during smoke tests which buckets each sheet went
  // to.
  classifications: { name: string; type: SheetClassification }[];
  totalRows: number;
  usedRows: number;
  truncated: boolean;
  charTruncated: boolean;
};

type ContentPayload = Array<
  | { type: "text"; text: string }
  | {
      type: "image" | "document";
      source: { type: "base64"; media_type: string; data: string };
    }
>;

type ParseResult = {
  data: Record<string, unknown> | Record<string, unknown>[];
  partial: boolean;
};

function readAsBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] ?? "";
      const fallback = file.name.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "image/png";
      resolve({ base64, mediaType: file.type || fallback });
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

function isDocx(file: File): boolean {
  return file.name.toLowerCase().endsWith(".docx") || file.type === DOCX_MIME;
}

async function readDocxAsText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

function cleanCsvText(raw: string): string {
  const lines = raw.split(/\r?\n/).map((line) => {
    const trimmed = line.replace(/,+\s*$/, "").trimEnd();
    return /^[,\s]*$/.test(trimmed) ? "" : trimmed;
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function csvEscapeCell(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Classifies an entire sheet (as a 2D array) into rate / catalog / lcl. The
// rate path goes through chunked rate-extraction; catalog and lcl bypass it.
//
//   "lcl"     — handled by isLclSheet's existing heuristic (per-pallet/M3,
//               Insulation Chile/Argentina headers, no POL+POD+Type triple).
//   "catalog" — any of the three patterns below:
//                 P1: no POL+POD+Type triple AND has a Charges/Area/Item
//                     header
//                 P2: no POL+POD+Type triple AND a strong majority of rows
//                     match a "<Label> <USD num> per container/BL/teu" line
//                 P3: HAS the POL+POD+Type triple, but POD and POL are both
//                     undifferentiated across data rows (≤1 unique value
//                     each) AND a precarriage / inland / trucking / haulage
//                     label is present (sheet name OR cell content). This
//                     captures sheets like IWS "Precarriage" that look
//                     rate-shaped but are really one catalog charge split
//                     by container size.
//   "rate"    — default when no catalog pattern matches. Losing a catalog
//               sheet to the rate path is recoverable (Claude returns no
//               rates from it); losing a rate sheet to catalog drops
//               10s-100s of rates silently.
function classifySheet(
  aoa: unknown[][],
  sheetName: string
): SheetClassification {
  if (aoa.length === 0) return "rate";
  const sheetText = aoa
    .slice(0, 50)
    .map((r) => r.map((c) => String(c ?? "")).join(" | "))
    .join("\n");
  if (isLclSheet(sheetText)) return "lcl";

  const headerArea = aoa.slice(0, 5);
  const cellMatches = (re: RegExp) =>
    headerArea.some((r) =>
      r.some((c) => re.test(String(c ?? "")))
    );
  const hasPol = cellMatches(/\bpol\b/i);
  const hasPod = cellMatches(/\bpod\b/i);
  const hasType = cellMatches(/\b(type|tipo|equipment|container)\b/i);
  const hasPolPodType = hasPol && hasPod && hasType;

  const dataRows = aoa
    .slice(1)
    .filter((r) => r.some((c) => String(c ?? "").trim() !== ""));

  // P3: rate-shaped sheet that is really a single catalog charge tier'd by
  // container size. Look for POL/POD column indices in the header area, then
  // check whether their data values collapse to a single unique entry. If
  // yes, plus a precarriage-style label present, classify as catalog.
  if (hasPolPodType && dataRows.length > 0) {
    let podColIdx = -1;
    let polColIdx = -1;
    for (const row of headerArea) {
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] ?? "");
        if (podColIdx === -1 && /\bpod\b/i.test(cell)) podColIdx = j;
        if (polColIdx === -1 && /\bpol\b/i.test(cell)) polColIdx = j;
      }
    }
    if (podColIdx !== -1 && polColIdx !== -1) {
      const uniquePods = new Set(
        dataRows
          .map((r) => String(r[podColIdx] ?? "").trim().toLowerCase())
          .filter(Boolean)
      );
      const uniquePols = new Set(
        dataRows
          .map((r) => String(r[polColIdx] ?? "").trim().toLowerCase())
          .filter(Boolean)
      );
      const sheetNameMatchesCatalog =
        /precarriage|inland|trucking|haulage|^fca\b/i.test(sheetName);
      const dataHasCatalogLabel = dataRows.some((r) =>
        r.some((c) =>
          /\b(fca\s+[a-záéíóúñ]+|precarriage|inland|trucking|haulage)\b/i.test(
            String(c ?? "")
          )
        )
      );
      if (
        uniquePods.size <= 1 &&
        uniquePols.size <= 1 &&
        (sheetNameMatchesCatalog || dataHasCatalogLabel)
      ) {
        return "catalog";
      }
    }
    return "rate";
  }

  // P1 / P2: no POL+POD+Type triple, look for catalog header or majority
  // "USD X per ..." rows.
  const hasCatalogHeader = headerArea.some((r) =>
    r.some((c) => /^(charges?|area|item)\b/i.test(String(c ?? "").trim()))
  );
  const perContainerRows = dataRows.filter((r) =>
    r.some((c) =>
      /per\s+(container|ctr|teu|bl)|x\s*bl|usd\s+[\d.,]+/i.test(String(c ?? ""))
    )
  ).length;
  const catalogPatternMajority =
    dataRows.length > 0 &&
    perContainerRows >= Math.ceil(dataRows.length * 0.3);

  if (hasCatalogHeader || catalogPatternMajority) return "catalog";
  return "rate";
}

async function readExcelAsText(file: File): Promise<ExcelReadResult> {
  const buffer = await file.arrayBuffer();
  // cellDates: true converts Excel datetime serials into JS Date objects at
  // read time. Combined with raw: false + dateNF: 'yyyy-mm-dd' below, every
  // datetime cell comes through sheet_to_json as an ISO string regardless
  // of the cell's locale-specific format ("30-Jun" / "30/06/2026" / etc.).
  // Without this, the row converter's date comparisons against the batch
  // validity got fooled by format mismatches and emitted spurious
  // "Validez específica" notes for every row.
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const rateSheets: string[] = [];
  const kindsBlocks: string[] = [];
  const classifications: { name: string; type: SheetClassification }[] = [];
  let totalRows = 0;
  let usedRows = 0;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    // raw: false applies cell formatting at read time. Excel datetime serial
    // numbers (45838) become formatted strings; dateNF forces all date
    // cells to ISO yyyy-mm-dd so the downstream date comparisons see a
    // canonical format regardless of the cell's locale formatting.
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
      raw: false,
      dateNF: "yyyy-mm-dd",
    });
    if (aoa.length === 0) continue;
    const maxCols = Math.max(0, ...aoa.map((r) => r.length));

    const classification = classifySheet(aoa, name);
    classifications.push({ name, type: classification });
    if (classification === "lcl") continue;

    if (classification === "catalog") {
      // Whole sheet is a kinds catalog. Send it to the kinds-extraction
      // pass verbatim (cells joined " | " per row) and skip rate chunking.
      const lines: string[] = [];
      for (const r of aoa) {
        const cells: string[] = [];
        for (let c = 0; c < maxCols; c++) {
          const v = String(r[c] ?? "").trim();
          if (v) cells.push(v);
        }
        if (cells.length > 0) lines.push(cells.join(" | "));
      }
      if (lines.length > 0) {
        kindsBlocks.push(`Hoja: ${name}\n${lines.join("\n")}`);
      }
      continue;
    }

    // classification === "rate" — apply right-boundary detection so the
    // leftmost block (rates) goes to the chunk prompt and the right block
    // (Items table, free-text discount, "Please note..." boxes) joins the
    // kinds-extraction pass.
    let rightBoundary = maxCols;
    for (let c = 0; c < maxCols; c++) {
      if (aoa.every((r) => String(r[c] ?? "").trim() === "")) {
        rightBoundary = c;
        break;
      }
    }

    const keepCols: number[] = [];
    for (let c = 0; c < rightBoundary; c++) {
      if (aoa.some((r) => String(r[c] ?? "").trim() !== "")) keepCols.push(c);
    }
    if (keepCols.length === 0) continue;

    if (rightBoundary < maxCols) {
      const rightLines: string[] = [];
      for (const r of aoa) {
        const cells: string[] = [];
        for (let c = rightBoundary; c < maxCols; c++) {
          const v = String(r[c] ?? "").trim();
          if (v) cells.push(v);
        }
        if (cells.length > 0) rightLines.push(cells.join(" | "));
      }
      if (rightLines.length > 0) {
        kindsBlocks.push(`Hoja: ${name}\n${rightLines.join("\n")}`);
      }
    }

    const csvLines = aoa.map((r) =>
      keepCols.map((c) => csvEscapeCell(String(r[c] ?? ""))).join(",")
    );
    const cleaned = cleanCsvText(csvLines.join("\n"));
    if (!cleaned) continue;
    const lines = cleaned.split("\n");
    totalRows += lines.length;
    if (usedRows < EXCEL_MAX_ROWS) {
      const taken = lines.slice(0, EXCEL_MAX_ROWS - usedRows);
      rateSheets.push(`Hoja: ${name}\n${taken.join("\n")}`);
      usedRows += taken.length;
    }
  }

  // Surface the classification in the browser console for smoke-test
  // observability. One line per sheet so it's easy to scan.
  if (typeof console !== "undefined") {
    for (const c of classifications) {
      console.log(`[rate-extract] Hoja "${c.name}": clasificada como ${c.type}`);
    }
  }

  let text = rateSheets.join("\n\n");
  let charTruncated = false;
  if (text.length > EXCEL_MAX_CHARS) {
    text = text.slice(0, EXCEL_MAX_CHARS) + "\n... (truncado)";
    charTruncated = true;
  }
  return {
    text,
    kindsBlock: kindsBlocks.join("\n\n"),
    classifications,
    totalRows,
    usedRows,
    truncated: totalRows > usedRows,
    charTruncated,
  };
}

function chunkExcelCsv(text: string, rowsPerChunk = CHUNK_DATA_ROWS): string[] {
  const meaningful = text
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.trim().startsWith("Hoja:"));
  if (meaningful.length === 0) return [text];
  const header = meaningful[0]!;
  const dataRows = meaningful.slice(1);
  if (dataRows.length === 0) return [meaningful.join("\n")];
  const chunks: string[] = [];
  for (let i = 0; i < dataRows.length; i += rowsPerChunk) {
    chunks.push([header, ...dataRows.slice(i, i + rowsPerChunk)].join("\n"));
  }
  return chunks;
}

function stripCodeFences(s: string): string {
  return s
    .replace(/```(?:json|JSON|js|JS)?\s*\n?/g, "")
    .replace(/```/g, "")
    .trim();
}

function extractJsonRegion(s: string): string {
  const firstBracket = s.indexOf("[");
  const firstBrace = s.indexOf("{");
  const lastBracket = s.lastIndexOf("]");
  const lastBrace = s.lastIndexOf("}");
  const arrayLooksOuter =
    firstBracket !== -1 &&
    lastBracket !== -1 &&
    (firstBrace === -1 || firstBracket < firstBrace) &&
    (lastBrace === -1 || lastBracket > lastBrace);
  if (arrayLooksOuter) return s.slice(firstBracket, lastBracket + 1);
  if (firstBrace !== -1 && lastBrace !== -1) {
    return s.slice(firstBrace, lastBrace + 1);
  }
  return s;
}

function autoCloseJson(s: string): string {
  let inString = false;
  let escape = false;
  let braceCount = 0;
  let bracketCount = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{") braceCount++;
    else if (c === "}") braceCount--;
    else if (c === "[") bracketCount++;
    else if (c === "]") bracketCount--;
  }
  let out = s;
  if (inString) out += '"';
  out = out.replace(/,\s*$/, "");
  while (braceCount > 0) {
    out += "}";
    braceCount--;
  }
  while (bracketCount > 0) {
    out += "]";
    bracketCount--;
  }
  return out;
}

function recoverJsonArray(s: string): Record<string, unknown>[] | undefined {
  const start = s.indexOf("[");
  if (start === -1) return undefined;
  const out: Record<string, unknown>[] = [];
  let i = start + 1;
  while (i < s.length) {
    while (i < s.length && /[\s,]/.test(s.charAt(i))) i++;
    if (i >= s.length) break;
    const c = s.charAt(i);
    if (c === "]") break;
    if (c !== "{") break;
    let depth = 0;
    let inStr = false;
    let escape = false;
    let end = -1;
    for (let j = i; j < s.length; j++) {
      const ch = s.charAt(j);
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inStr = !inStr;
        continue;
      }
      if (inStr) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end === -1) break;
    try {
      out.push(JSON.parse(s.slice(i, end + 1)) as Record<string, unknown>);
    } catch {
      break;
    }
    i = end + 1;
  }
  return out.length > 0 ? out : undefined;
}

function parseExtractedJson(raw: string): ParseResult {
  const stripped = stripCodeFences(raw);
  const region = extractJsonRegion(stripped);
  try {
    return {
      data: JSON.parse(region) as
        | Record<string, unknown>
        | Record<string, unknown>[],
      partial: false,
    };
  } catch {
    try {
      const closed = autoCloseJson(region);
      return {
        data: JSON.parse(closed) as
          | Record<string, unknown>
          | Record<string, unknown>[],
        partial: true,
      };
    } catch {
      const recovered = recoverJsonArray(region);
      if (recovered) return { data: recovered, partial: true };
      throw new Error("No se pudo recuperar JSON parseable");
    }
  }
}

function toRecordArray(
  parsed: Record<string, unknown> | Record<string, unknown>[]
): Record<string, unknown>[] {
  if (Array.isArray(parsed)) return parsed;
  for (const key of ["items", "results", "rates"]) {
    const v = (parsed as Record<string, unknown>)[key];
    if (Array.isArray(v)) return v as Record<string, unknown>[];
  }
  return [parsed];
}

function toNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toStr(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

// ============================================================================
// v3 extraction-pipeline types and helpers
// ============================================================================

// Shape of one rate row as returned by Claude (post-JSON-parse, pre-Frontend
// canonicalization). The fields are loose-typed because Claude can drop or
// vary field names slightly; toStr/toNumber coerce later.
type RawRate = {
  carrier?: unknown;
  pol?: unknown;
  pod?: unknown;
  route?: unknown;
  type?: unknown;
  tipo?: unknown;
  sl?: unknown;
  sf?: unknown;
  bl_fee?: unknown;
  blFee?: unknown;
  validFrom?: unknown;
  validTo?: unknown;
  kinds?: unknown;
  notas?: unknown;
  notes?: unknown;
  incoterm?: unknown;
};

type RawKind = {
  label?: unknown;
  value20?: unknown;
  value40?: unknown;
  value_unique?: unknown;
};

// Wrapper Claude returns for the non-chunked path. The chunked path returns
// just { rates: [...] } — agent/validity/notas inference happens elsewhere.
type ExtractedBatch = {
  agent_inferred?: string;
  validity_inferred?: { from?: string | null; to?: string | null } | null;
  notas_globales?: string;
  rates: RawRate[];
};

const QUARTER_LABELS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

// Coerces a free-text "type" value out of an extracted row to one of the v3
// ContainerType literals. Falls back to migrateContainerType which knows about
// historical synonyms ("40'HC", "20'-Flexi", "Reefer", etc.).
function coerceContainerType(raw: unknown): {
  tipo: ContainerType;
  note?: string;
} {
  const s = toStr(raw);
  if (CONTAINER_TYPES.includes(s as ContainerType)) {
    return { tipo: s as ContainerType };
  }
  return migrateContainerType(s);
}

// Aggregates kind labels from all extracted rows into a deduplicated list of
// KindDef + KindValue. Predefined ids win when an alias matches; unknown
// labels become custom kinds with scope="all" and by_size inferred from
// whether any row carried value20/value40 for that label. The first
// non-empty value seen for a given (kindId, size) wins — sufficient for the
// fixture's "all rates share the same kind values per agent" pattern.
function detectKindsFromExtracted(rates: RawRate[]): {
  kinds: KindDef[];
  kindValues: KindValue[];
  preferentialEntries: Array<{
    clients: string[];
    kindLabel: string;
    value20?: number;
    value40?: number;
    value_unique?: number;
  }>;
} {
  const kindsById = new Map<string, KindDef>();
  const valuesById = new Map<string, KindValue>();
  const preferentialEntries: Array<{
    clients: string[];
    kindLabel: string;
    value20?: number;
    value40?: number;
    value_unique?: number;
  }> = [];
  for (const r of rates) {
    if (!Array.isArray(r.kinds)) continue;
    for (const k of r.kinds as RawKind[]) {
      const label = toStr(k.label).trim();
      if (!label) continue;

      // Reject regional add-on rows that leak from catalog sheets when
      // Claude tries to interpret them as kinds. The detectRegionalAddons
      // sweep captures these for notas_globales — they must NOT also
      // become kinds. Tell-tale signal: "on top of" or "Add <City> US$".
      if (
        /\bon\s+top\s+of\b/i.test(label) ||
        /^add\s+\S+\s+(us\$?|usd)\s+[\d.,]+/i.test(label)
      ) {
        continue;
      }
      // Reject commodity-group descriptor labels that are NOT charges.
      // Backstop in case Claude misclassifies a header line like
      // "Wine/Juice loads" / "Frozen loads" / "Dry loads" / "Reefer
      // loads" as a kind. The prompt already instructs Claude to skip
      // these — this catches the leak.
      if (
        /^(?:wine(?:\s*\/\s*juice)?|juice|nueces|frozen|fresh|vegetables|bottled|hazardous|dry|reefer|flexi)\s+loads?\b/i.test(
          label
        )
      ) {
        continue;
      }
      // Reject EBS / EFS / BAF / BL Fee / documentation fee — these are
      // NEVER kinds. EBS is tracked separately in the EBS table; BL Fee
      // is a native field on the Rate populated by RATE_SYSTEM. Even
      // when KINDS_FROM_BLOCK_SYSTEM mistakenly emits them, the
      // frontend drops them here. Match is anchored — "EBS Surcharge"
      // and "BL Fee 20'" both fall through.
      if (
        /^(?:ebs|efs|baf|emergency\s+bunker(?:\s+surcharge)?|bunker\s+surcharge|bl\s*fee|bill\s+of\s+lading(?:\s+fee)?|documentation(?:\s+fee)?|doc\s+fee)\b/i.test(
          label
        )
      ) {
        continue;
      }

      // Preferential-client kind labels ("Insulado Chile (ASC - Aussino -
      // EMW)") are routed to notas_globales instead of becoming batch-wide
      // kinds — the rate only applies to those clients.
      const pref = extractPreferentialClientsFromLabel(label);
      if (pref) {
        const canonicalId = matchKindByAlias(pref.cleanLabel);
        const canonicalLabel = canonicalId
          ? PREDEFINED_KINDS.find((p) => p.id === canonicalId)?.label ??
            pref.cleanLabel
          : pref.cleanLabel;
        const v20 = toNumber(k.value20);
        const v40 = toNumber(k.value40);
        const vu = toNumber(k.value_unique);
        preferentialEntries.push({
          clients: pref.clients,
          kindLabel: canonicalLabel,
          value20: v20 || undefined,
          value40: v40 || undefined,
          value_unique: vu || undefined,
        });
        continue;
      }

      // Strip a size annotation ("20'Flexi", "40'DC", etc.) so that
      // catalog rows like "Precarriage 20'Flexi Mendoza" / "Precarriage
      // 40'DC Mendoza" canonicalize to the same alias and consolidate
      // into one kind. The labelSize lets value_unique route to the
      // matching value20/value40 instead of being copied to both.
      const { cleanLabel, size: labelSize } = extractSizeFromKindLabel(label);
      const matchedId =
        matchKindByAlias(cleanLabel) ?? matchKindByAlias(label);

      let kindId: string;
      let def: KindDef;
      if (matchedId) {
        const pred = PREDEFINED_KINDS.find((p) => p.id === matchedId);
        if (!pred) continue;
        kindId = pred.id;
        def = pred;
      } else {
        kindId = "custom_" + slugifyKindLabel(label);
        const hasSizeValue =
          k.value20 !== undefined && k.value20 !== null && k.value20 !== ""
            ? true
            : k.value40 !== undefined && k.value40 !== null && k.value40 !== "";
        def = {
          id: kindId,
          label,
          scope: "all",
          by_size: hasSizeValue,
          predefined: false,
        };
      }
      if (!kindsById.has(kindId)) kindsById.set(kindId, def);

      let kv = valuesById.get(kindId);
      if (!kv) {
        kv = { kind_id: kindId };
        valuesById.set(kindId, kv);
      }
      const v20 = toNumber(k.value20);
      const v40 = toNumber(k.value40);
      const vu = toNumber(k.value_unique);
      if (v20 && kv.value20 === undefined) kv.value20 = v20;
      if (v40 && kv.value40 === undefined) kv.value40 = v40;
      if (vu) {
        if (def.by_size) {
          // Route value_unique to the bucket implied by the label's size
          // hint when present, so split-by-size catalog rows accumulate
          // correctly. Fallback (no size hint): copy to both, matching
          // the CCL "Thermal Liner = USD 350" case.
          if (labelSize === 20 && kv.value20 === undefined) {
            kv.value20 = vu;
          } else if (labelSize === 40 && kv.value40 === undefined) {
            kv.value40 = vu;
          } else if (labelSize === null) {
            if (kv.value20 === undefined) kv.value20 = vu;
            if (kv.value40 === undefined) kv.value40 = vu;
          }
        } else if (kv.value_unique === undefined) {
          kv.value_unique = vu;
        }
      }
    }
  }
  // Defense: drop kinds whose value fields are all empty/zero. This filters
  // false positives from extraction artifacts where Claude emits a kind
  // because it saw a column header but the actual cell was "Included" /
  // "Incl." / "Bundled" / blank (BAF column being the canonical case in
  // IWS). A kind with no usable numbers is just noise in the editor.
  for (const [id, kv] of valuesById) {
    const has20 = (kv.value20 ?? 0) !== 0;
    const has40 = (kv.value40 ?? 0) !== 0;
    const hasUnique = (kv.value_unique ?? 0) !== 0;
    if (!has20 && !has40 && !hasUnique) {
      valuesById.delete(id);
      kindsById.delete(id);
    }
  }
  return {
    kinds: Array.from(kindsById.values()),
    kindValues: Array.from(valuesById.values()),
    preferentialEntries,
  };
}

// Expands rate rows whose POD field carries multiple ports separated by
// "/" (e.g. "Antwerp / Rotterdam / Hamburg / London") into one row per
// POD. POL / carrier / type / sf / kinds stay identical. Independent of
// the multi-carrier and multi-equipment expansions — runs BEFORE them so
// a row with both multi-POD + multi-carrier produces M*N final rows. The
// IWS Seafreight sheet is the canonical fixture for this pattern.
function expandMultiPod(rates: RawRate[]): RawRate[] {
  const out: RawRate[] = [];
  for (const r of rates) {
    const pod = toStr(r.pod).trim();
    if (!pod || !pod.includes("/")) {
      out.push(r);
      continue;
    }
    const pods = pod
      .split("/")
      .map((p) => p.trim())
      .filter(Boolean);
    if (pods.length <= 1) {
      out.push(r);
      continue;
    }
    for (const p of pods) {
      out.push({ ...r, pod: p });
    }
  }
  return out;
}

// Expands rate rows whose `type` / `tipo` field combines two container
// types via "/" (e.g. "20'Flexi/DC", "20'DC/Flexi", "40'DC/Reefer") into
// two rates with distinct types. "DC" is treated as a Dry alias and "RF"
// as Reefer. Inter-Tank's catalog has only 4 valid types — invalid combos
// (e.g. "20'Flexi/Reefer" → "20'Reefer") are emitted verbatim and the
// downstream migrateContainerType pipeline coerces them to a valid
// neighbour with a warning note. The IWS Seafreight sheet routinely uses
// "20'Flexi/DC" to mean the rate applies to both 20'Flexi and 20'Dry.
function expandCombinedEquipment(rates: RawRate[]): RawRate[] {
  const splitRe =
    /^(\d+)['′]?\s*(Flexi|Dry|DC|Reefer|RF)\s*\/\s*(?:(\d+)['′]?\s*)?(Flexi|Dry|DC|Reefer|RF)$/i;
  const mapCat = (c: string): string => {
    const upper = c.toUpperCase();
    if (upper === "DC") return "Dry";
    if (upper === "RF") return "Reefer";
    return upper.charAt(0) + upper.slice(1).toLowerCase();
  };
  const out: RawRate[] = [];
  for (const r of rates) {
    const tipoRaw = toStr(r.type ?? r.tipo).trim();
    if (!tipoRaw) {
      out.push(r);
      continue;
    }
    const m = tipoRaw.match(splitRe);
    if (!m) {
      out.push(r);
      continue;
    }
    const size1 = m[1] ?? "";
    const cat1 = m[2] ?? "";
    const size2 = m[3] ?? size1;
    const cat2 = m[4] ?? "";
    const t1 = `${size1}'${mapCat(cat1)}`;
    const t2 = `${size2}'${mapCat(cat2)}`;
    if (t1 === t2) {
      out.push({ ...r, type: t1, tipo: t1 });
      continue;
    }
    out.push({ ...r, type: t1, tipo: t1 });
    out.push({ ...r, type: t2, tipo: t2 });
  }
  return out;
}

// Expands rate rows whose `sl` field carries multiple carriers (e.g.
// "OOCL or CMA", "OOCL/EVER") into one row per carrier. Pol/pod/type/sf/etc.
// stay identical; only the carrier and sl strings differ. Returns the input
// unchanged when no row has a multi-carrier signal.
function expandMultiCarrier(rates: RawRate[]): RawRate[] {
  const out: RawRate[] = [];
  for (const r of rates) {
    const sl = toStr(r.sl);
    const carriers = parseMultiCarrier(sl);
    if (carriers.length <= 1) {
      out.push(r);
      continue;
    }
    for (const c of carriers) {
      out.push({ ...r, sl: c, carrier: c });
    }
  }
  return out;
}

// (dropLclSheetsFromExcelText was removed — sheet classification + LCL
// detection now happen at read time inside readExcelAsText.)

// Defense-in-depth sweep: scans free-form text (notas globales, right-side
// block, per-rate notas) for kind patterns that might have slipped past the
// structured extraction. Returns NEW kinds + values to append; only emits
// kinds whose id isn't already present in `existing`.
// Filters Excel-extracted rate.notas content so the Step 2 / saved-rate
// "Notas" column doesn't carry junk values that already live in dedicated
// fields (Incoterm, POL). KATAOKA fixture surfaces Comments column data
// that mixes legitimate notes ("Rate includes 24,000 lts flexi...") with
// repeated single-token cells like "FOB" / "FCA" / "FCA Mendoza" — those
// are read off the Incoterm / POL columns and provide no information
// once the structured fields exist. Rules:
//   - drop a line that exactly equals the rate's incoterm
//   - drop a line that exactly equals the rate's pol
//   - drop standalone Incoterm tokens, optionally followed by a city
//   - drop very short lines (< 5 chars) — almost always junk
//   - drop excluded-kind phrases (Fix 1 byproduct: "Doesn't included
//     Disposal USD 190" is now tagged on the rate via affected_rate_ids)
// Multi-line input: each line is filtered independently and rejoined.
function cleanIndividualNotes(
  raw: string,
  context: { incoterm?: string; pol?: string }
): string {
  if (!raw) return "";
  const sanitized = detectExcludedKindsFromText(raw).sanitizedText;
  const incNorm = (context.incoterm ?? "").trim().toUpperCase();
  const polNorm = (context.pol ?? "").trim().toLowerCase();
  const lines = sanitized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  // Standalone Incoterm token, optionally with a city suffix
  // ("FOB San Antonio" / "FCA Mendoza"). Always pure metadata.
  const incotermStandaloneRe =
    /^(FOB|CIF|CFR|FCA|EXW)(?:\s+[A-Za-zñáéíóúÑÁÉÍÓÚ][A-Za-zñáéíóúÑÁÉÍÓÚ\s]*)?$/i;
  // Single container-type token by itself ("Reefer", "Dry", "Flexi",
  // "Containers"). The LLM occasionally emits these into notes when the
  // source spreadsheet has a Type column header echoed in the comments
  // column. They carry no information beyond what the structured `tipo`
  // field already conveys.
  const bareTypeTokenRe = /^(Reefer|Dry|Flexi|Container[s]?)$/i;
  const filtered = lines.filter((line) => {
    if (incNorm && line.toUpperCase() === incNorm) return false;
    if (polNorm && line.toLowerCase() === polNorm) return false;
    if (incotermStandaloneRe.test(line)) return false;
    if (bareTypeTokenRe.test(line)) return false;
    // Bumped from 5 → 10 chars: 5 was too permissive (kept tokens like
    // "FCA AR" or "20'Dry" that survived the other filters). 10 still
    // lets through legitimate operational notes ("inland inc", "flex
    // 24klt") while dropping the noisy short fragments.
    if (line.length < 10) return false;
    return true;
  });
  return filtered.join("\n").trim();
}

function sweepKindsFromText(
  text: string,
  existing: KindDef[]
): { kinds: KindDef[]; kindValues: KindValue[] } {
  const newKinds: KindDef[] = [];
  const newValues: KindValue[] = [];
  const seen = new Set(existing.map((k) => k.id));
  const pushPredefined = (
    id: string,
    value: number,
    field: "value20" | "value40" | "value_unique"
  ) => {
    if (seen.has(id)) return;
    const def = PREDEFINED_KINDS.find((k) => k.id === id);
    if (!def) return;
    newKinds.push(def);
    newValues.push({ kind_id: id, [field]: value } as KindValue);
    seen.add(id);
  };

  if (!text) return { kinds: newKinds, kindValues: newValues };

  const di = detectDiscountInsulated(text);
  if (di !== null) pushPredefined("discount_insulated", di, "value_unique");

  const af = detectAgencyFee(text);
  if (af !== null) pushPredefined("agency_fee", af, "value_unique");

  const afMax = detectAgencyFeeMax(text);
  if (afMax !== null) pushPredefined("agency_fee_max", afMax, "value_unique");

  const disposal = detectDisposal(text);
  if (disposal !== null) pushPredefined("disposal", disposal, "value_unique");

  // Thermal Liner unsized → emit as insulado_chile with both 20 and 40 set
  // to the same value, matching the CCL fixture rule.
  const tlu = detectThermalLinerUnsized(text);
  if (tlu !== null && !seen.has("insulado_chile")) {
    const def = PREDEFINED_KINDS.find((k) => k.id === "insulado_chile");
    if (def) {
      newKinds.push(def);
      newValues.push({
        kind_id: "insulado_chile",
        value20: tlu,
        value40: tlu,
      });
      seen.add("insulado_chile");
    }
  }

  return { kinds: newKinds, kindValues: newValues };
}

// Builds the prefix shown in the Notas column of Step 2 / RatesTab so the
// user sees WHY a row is red (blocking) or amber (warning) without
// opening the modal. Reasons for warnings are derived from the row's
// current values (sf, blFee, pod, tipo) plus the batch validity — not
// from the rate.notes string. Blocking always wins; placeholder
// Incoterm "FOB/CIF/CFR" is intentionally NEVER a warning reason.
function buildWarningPrefix(
  row: Record<string, unknown>,
  batchValidity: { validFrom?: string; validTo?: string } | null
): { prefix: string; severity: "blocking" | "warning" | null } {
  const blockingError = String(row._blockingError ?? "").trim();
  if (blockingError) {
    return { prefix: `🚫 ${blockingError}`, severity: "blocking" };
  }
  if (row._needsReview !== true) {
    return { prefix: "", severity: null };
  }
  const reasons: string[] = [];
  const pod = String(row.pod ?? "");
  const tipo = String(row.tipo ?? "");
  const sfVal = row.sf;
  const blFeeVal = row.blFee;
  const sfNum = typeof sfVal === "number" ? sfVal : Number(sfVal);
  const blFeeNum = typeof blFeeVal === "number" ? blFeeVal : Number(blFeeVal);

  if (!Number.isFinite(sfNum)) {
    reasons.push("SF faltante en archivo");
  } else if (sfNum <= 0 && !isAsianPod(pod)) {
    reasons.push("SF ≤ 0 con POD no asiático");
  }

  if (Number.isFinite(blFeeNum) && blFeeNum <= 0) {
    const isReefer = tipo === "40'Reefer";
    if (!isAsianPod(pod) || isReefer) {
      reasons.push("BL Fee ≤ 0 — revisar");
    }
  } else if (!Number.isFinite(blFeeNum)) {
    reasons.push("BL Fee no detectado");
  }

  const batchTo = batchValidity?.validTo ?? "";
  if (batchTo && isDateInPast(batchTo)) {
    reasons.push("Validez del batch vencida");
  } else if (!batchTo || !isValidDate(batchTo)) {
    reasons.push("Validez del batch inválida");
  }

  // Tipo coerced is already surfaced via the row's notas (the row
  // converter pushes "Tipo no estándar..." into notes), so we don't
  // duplicate here.

  if (reasons.length === 0) {
    return {
      prefix: "⚠️ Revisar — motivo no especificado",
      severity: "warning",
    };
  }
  return { prefix: `⚠️ ${reasons.join(" · ")}`, severity: "warning" };
}

// Recomputes the flag set on a preview row when something at the batch
// level changed (validity, kinds) — without re-calling the LLM. Used
// by the useEffect that watches effectiveValidity so a user who clicks
// Procesar before picking Q2 can fix the batch validity afterwards and
// see all rows un-flag instantly.
function recomputeRowFlags(
  row: Record<string, unknown>,
  effectiveValidity: { validFrom: string; validTo: string } | null,
  batchKinds: KindDef[],
  batchKindValues: KindValue[],
  batchYearHint: number
): Record<string, unknown> {
  const carrier = String(row.carrier ?? "").trim();
  const pol = String(row.pol ?? "").trim();
  const pod = String(row.pod ?? "").trim();
  const tipo = String(row.tipo ?? "");
  const sfNum = Number(row.sf ?? 0);
  const blFeeNum = Number(row.blFee ?? 0);
  const sfParseable = isParsableNumber(row.sf);
  const blFeeParseable = isParsableNumber(row.blFee);

  // Recompute blocking in priority order matching the row converter.
  let blockingMessage: string | null = null;
  let blockingType: string | null = null;

  const range = validateRateRange({ tipo, sf: sfNum });
  if (range?.severity === "blocking") {
    blockingMessage = range.message;
    blockingType = "reefer_range";
  }
  if (!blockingMessage && !carrier) {
    for (const def of batchKinds) {
      const kv = batchKindValues.find((v) => v.kind_id === def.id);
      if (!kv) continue;
      if (
        kv.value20 === sfNum ||
        kv.value40 === sfNum ||
        kv.value_unique === sfNum
      ) {
        const matchedValue =
          kv.value20 === sfNum
            ? `${kv.value20} (20')`
            : kv.value40 === sfNum
              ? `${kv.value40} (40')`
              : `${kv.value_unique}`;
        blockingMessage = `SF=${sfNum} matchea el kind ${def.label} = ${matchedValue} y la rate tiene carrier vacío. Probable kind extraído como rate fantasma — verificá tipo, ruta y monto antes de guardar.`;
        blockingType = "phantom_kind";
        break;
      }
    }
  }
  if (!blockingMessage && (isCountryNotPort(pol) || isCountryNotPort(pod))) {
    const offending = isCountryNotPort(pol)
      ? `POL="${pol}"`
      : `POD="${pod}"`;
    blockingMessage = `${offending} es un país / región, no un puerto. Probable POL/POD inferido erróneamente — completá con el puerto real o eliminá la rate.`;
    blockingType = "country_not_port";
  }
  if (!blockingMessage && !carrier) {
    blockingMessage =
      "Carrier requerido — completá manualmente para guardar.";
    blockingType = "carrier_missing";
  }
  if (!blockingMessage && !pod) {
    blockingMessage =
      "Puerto de destino (POD) requerido — completá manualmente para guardar.";
    blockingType = "pod_missing";
  }

  const tipoCoerced = !(CONTAINER_TYPES as readonly string[]).includes(tipo);
  const needsReview = isRateNeedsReview(
    {
      pol,
      pod,
      tipo,
      tipoCoerced,
      sfNum,
      blFeeNum,
      sfParseable,
      blFeeParseable,
    },
    effectiveValidity,
    batchYearHint
  );

  return {
    ...row,
    _needsReview: needsReview || !!blockingMessage,
    _blockingError: blockingMessage,
    _blockingType: blockingType,
    _uncheckByDefault: !!blockingMessage,
  };
}

// ============================================================================
// Component
// ============================================================================

type Props = {
  // All existing rates in the catalog. Used for agent similarity check.
  existingRates: Rate[];
  // Called when the user confirms the multi-row save flow.
  onSaveMany: (rates: Rate[]) => void;
  // Called when the user confirms a single-row edit.
  onSaveEdit?: (rate: Rate) => void;
  // When set, the flow opens directly in single-row edit mode (skip Step 1).
  editingRate?: Rate | null;
  onCancel: () => void;
};

type Step = "input" | "preview";

export default function NewRateFlow({
  existingRates,
  onSaveMany,
  onSaveEdit,
  editingRate,
  onCancel,
}: Props) {
  const isEditMode = Boolean(editingRate);
  const [step, setStep] = useState<Step>(isEditMode ? "preview" : "input");

  // ---- Step 1: header (agent + validity + batch notas) ----
  const [agent, setAgent] = useState(editingRate?.agent ?? "");
  // Default to quarter — most agent rate sheets are quarterly. The dates and
  // quarter selections are preserved across mode toggles so the user can
  // flip back without losing what they had picked.
  const [validityMode, setValidityMode] = useState<"dates" | "quarter">(
    editingRate ? "dates" : "quarter"
  );
  const [validFrom, setValidFrom] = useState(editingRate?.validFrom ?? "");
  const [validTo, setValidTo] = useState(editingRate?.validTo ?? "");
  const [quarterYear, setQuarterYear] = useState<number>(
    new Date().getFullYear()
  );
  const [quarterPicked, setQuarterPicked] = useState<Set<Quarter>>(new Set());
  const [batchNotas, setBatchNotas] = useState("");

  // ---- Inferred (from extraction; used as fallback when user fields empty) ----
  const [agentInferred, setAgentInferred] = useState("");
  const [validityInferred, setValidityInferred] = useState<{
    from?: string | null;
    to?: string | null;
  } | null>(null);
  // Tracks the last block of inferred notes auto-appended to batchNotas. On
  // a re-process we strip this exact string off the end of batchNotas before
  // appending the new inferred block — keeps the user's manual edits intact
  // and avoids stacking duplicates across multiple processInput runs.
  const [lastAutoInsertedNotes, setLastAutoInsertedNotes] = useState("");
  // Dismissible info banner above the batchNotas textarea, shown when
  // processInput auto-appended inferred content. The user can close it; it
  // re-shows on the next processInput that produces inferred content.
  const [showAutoInsertBanner, setShowAutoInsertBanner] = useState(false);

  // ---- Step 1: kinds editor (zone b) ----
  const [batchKinds, setBatchKinds] = useState<KindDef[]>(
    editingRate?.kinds ? editingRate.kinds.map((k) => ({ ...k })) : []
  );
  const [batchKindValues, setBatchKindValues] = useState<KindValue[]>(
    editingRate?.kind_values ? editingRate.kind_values.map((kv) => ({ ...kv })) : []
  );

  const agentSuggestions = useMemo(
    () => uniqueSuggestions(existingRates.map((r) => r.agent), AGENT_SUGGESTIONS),
    [existingRates]
  );

  // POD catalog derived from every saved rate. Surfaces in the inline-edit
  // datalist (Fix 9) so typing a partial port name autocompletes against
  // existing entries — and at commit time we run resolvePodCanonical to
  // collapse casing variants before they reach storage.
  const podSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const r of existingRates) {
      const v = (r.pod ?? "").trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [existingRates]);
  const knownPods = podSuggestions;

  // Smart agent detection — runs on every keystroke.
  const agentMatch = useMemo(
    () => findSimilarAgent(agent, existingRates),
    [agent, existingRates]
  );

  // ---- Step 1: file/text input ----
  const [fileName, setFileName] = useState("");
  const [imageData, setImageData] = useState<
    { base64: string; mediaType: string } | null
  >(null);
  const [docxText, setDocxText] = useState("");
  const [excelText, setExcelText] = useState("");
  // Combined kinds-bearing content captured at Excel read time: catalog
  // sheets (entire content) + the right-side block of rate sheets (cells
  // past the first empty separator column). Stored separately from
  // excelText so the rate-extraction chunks contain ONLY rate-table content;
  // the kinds-extraction pass takes this. Also fed to the regex sweeps for
  // regional add-ons / EBS NOT INCLUDED / etc.
  const [excelKindsBlock, setExcelKindsBlock] = useState("");
  // Per-sheet classification (rate / catalog / lcl) for surfacing in the
  // info banner.
  const [excelSheetClassifications, setExcelSheetClassifications] = useState<
    { name: string; type: SheetClassification }[]
  >([]);
  const [excelTruncWarning, setExcelTruncWarning] = useState<string | null>(
    null
  );
  const [pasteText, setPasteText] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // ---- Step 2: preview ----
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>(
    isEditMode && editingRate
      ? [
          {
            carrier: editingRate.carrier,
            pol: editingRate.pol ?? "",
            pod: editingRate.pod ?? "",
            route: editingRate.route,
            tipo: editingRate.tipo,
            sl: editingRate.sl ?? editingRate.carrier,
            sf: editingRate.sf,
            blFee: editingRate.blFee,
            notes: editingRate.notes,
          },
        ]
      : []
  );
  const [previewSelected, setPreviewSelected] = useState<Set<number>>(
    new Set(isEditMode ? [0] : [])
  );
  const [editingIdx, setEditingIdx] = useState<number | null>(
    isEditMode ? 0 : null
  );

  const [chunkProgress, setChunkProgress] = useState<{
    current: number;
    total: number;
    retrying?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractionDone, setExtractionDone] = useState(isEditMode);
  const [extractionInfo, setExtractionInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Validation modal shown when the user clicks "Procesar archivo" without
  // filling the required batch fields (agent + validity). The modal lists
  // the missing fields and focuses the offending input on close.
  const [validationModal, setValidationModal] = useState<{
    fields: string[];
    focusTarget: "agent" | "validity";
  } | null>(null);

  // Validity resolution from user inputs alone (Step 1 dates/quarter pickers).
  const resolvedValidity = useMemo(() => {
    if (validityMode === "dates") {
      if (!validFrom) return null;
      if (validTo && validTo < validFrom) return null;
      return { validFrom, validTo };
    }
    return quartersToDateRange(quarterYear, quarterPicked);
  }, [validityMode, validFrom, validTo, quarterYear, quarterPicked]);

  // Effective agent / validity: user input wins. The inferred values are used
  // ONLY as fallback when the user fields are empty at the moment of save.
  // No detector ever overwrites a non-empty user field — see PRECEDENCE rule.
  const effectiveAgent = agent.trim() || agentInferred.trim();
  const effectiveValidity = useMemo<{ validFrom: string; validTo: string } | null>(
    () => {
      if (resolvedValidity) return resolvedValidity;
      if (validityInferred?.from) {
        return {
          validFrom: validityInferred.from,
          validTo: validityInferred.to ?? "",
        };
      }
      return null;
    },
    [resolvedValidity, validityInferred]
  );

  const hasInput =
    !!fileName || !!pasteText.trim() || !!imageData || !!docxText || !!excelText;

  // Validation for "Continuar al preview" — runs after extraction has populated
  // suggestions, so we check effectiveAgent/effectiveValidity (user OR inferred).
  const continueErrors: string[] = [];
  if (!effectiveAgent.trim()) continueErrors.push("Falta indicar el agente.");
  if (!effectiveValidity)
    continueErrors.push(
      validityMode === "dates"
        ? validFrom && validTo && validTo < validFrom
          ? "La fecha 'Vigente hasta' debe ser ≥ 'Vigente desde'."
          : "Falta la fecha de validez desde."
        : "Falta seleccionar al menos un quarter."
    );
  if (!extractionDone && !isEditMode)
    continueErrors.push("Procesá el archivo antes de continuar.");

  // ---- File handling ----
  const handleFile = async (file: File) => {
    setError(null);
    setExcelTruncWarning(null);
    setFileName(file.name);
    setImageData(null);
    setDocxText("");
    setExcelText("");
    setExcelKindsBlock("");
    setExcelSheetClassifications([]);
    setExtractionDone(false);
    if (file.size > LARGE_FILE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setExcelTruncWarning(
        `Archivo muy grande (${mb} MB) — puede tardar más en procesarse.`
      );
    }
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        const result = await readExcelAsText(file);
        if (!result.text.trim()) {
          setError("El Excel no contiene datos.");
          return;
        }
        setExcelText(result.text);
        setExcelKindsBlock(result.kindsBlock);
        setExcelSheetClassifications(result.classifications);
        const warnings: string[] = [];
        if (result.truncated) {
          warnings.push(
            `Excel tiene ${result.totalRows} filas — se procesarán las primeras ${result.usedRows}.`
          );
        }
        if (result.charTruncated) {
          warnings.push(
            `El texto excede ${EXCEL_MAX_CHARS} caracteres — se truncó antes de enviarlo a Claude.`
          );
        }
        if (warnings.length > 0)
          setExcelTruncWarning(warnings.join(" "));
      } else if (isDocx(file)) {
        const text = await readDocxAsText(file);
        if (!text.trim()) {
          setError("El documento Word no contiene texto extraíble.");
          return;
        }
        setDocxText(text);
      } else {
        const data = await readAsBase64(file);
        setImageData(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al leer el archivo");
    }
  };

  // ---- API calls ----
  const callExtractApi = async (
    content: string | ContentPayload,
    system: string
  ): Promise<{ rows: Record<string, unknown>[]; partial: boolean }> => {
    const res = await fetch("/api/billing/extract-rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, content }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `API error ${res.status}`);
    }
    const { text: responseText } = (await res.json()) as { text: string };
    const parsed = parseExtractedJson(responseText);
    return { rows: toRecordArray(parsed.data), partial: parsed.partial };
  };

  const processChunks = async (
    items: Array<{ index: number; content: string }>,
    totalForUi: number
  ) => {
    const rows: Record<string, unknown>[] = [];
    const failed: number[] = [];
    let partial = false;
    for (const item of items) {
      let success = false;
      for (let attempt = 0; attempt < MAX_CHUNK_ATTEMPTS && !success; attempt++) {
        setChunkProgress({
          current: item.index,
          total: totalForUi,
          retrying: attempt > 0,
        });
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
        try {
          const result = await callExtractApi(item.content, RATE_CHUNK_SYSTEM);
          rows.push(...result.rows);
          if (result.partial) partial = true;
          success = true;
        } catch {
          // retry
        }
      }
      if (!success) failed.push(item.index);
    }
    return { rows, failed, partial };
  };

  // Coerces an array of API response objects into ExtractedBatch shape.
  // The chunked path returns one object per chunk (each with .rates); the
  // single-call path returns one object with the whole batch wrapper.
  const collectBatchFromChunks = (rows: Record<string, unknown>[]): ExtractedBatch => {
    const allRates: RawRate[] = [];
    let agentInf = "";
    let validityInf: ExtractedBatch["validity_inferred"] = null;
    let notasGlob = "";
    for (const r of rows) {
      const ratesField = (r as Record<string, unknown>).rates;
      if (Array.isArray(ratesField)) {
        allRates.push(...(ratesField as RawRate[]));
      } else if (
        Array.isArray(r) === false &&
        ((r.carrier !== undefined) || (r.type !== undefined) || (r.tipo !== undefined))
      ) {
        // Some chunks may return a bare rate object instead of { rates: [...] }
        allRates.push(r as RawRate);
      }
      if (!agentInf && typeof r.agent_inferred === "string") {
        agentInf = r.agent_inferred;
      }
      if (!validityInf && r.validity_inferred && typeof r.validity_inferred === "object") {
        validityInf = r.validity_inferred as ExtractedBatch["validity_inferred"];
      }
      if (!notasGlob && typeof r.notas_globales === "string") {
        notasGlob = r.notas_globales;
      }
    }
    return {
      agent_inferred: agentInf,
      validity_inferred: validityInf,
      notas_globales: notasGlob,
      rates: allRates,
    };
  };

  // ---- Kinds-from-block second pass ----
  // Runs only when an Excel right-side block was captured. Uses the same
  // /api/billing/extract-rate route so it inherits haiku for text-only payloads
  // (route.ts: TEXT_MODEL = claude-haiku-4-5-20251001). Two-attempt retry; on
  // failure, returns null and the main flow keeps going (graceful degradation:
  // the regex sweep below picks up the obvious cases anyway).
  const extractKindsFromBlock = async (
    blockText: string
  ): Promise<{ kinds: RawKind[]; notas_globales: string } | null> => {
    if (!blockText.trim()) return null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await callExtractApi(
          `Bloque de texto (Items / descuento / notas) para extracción de kinds:\n\n${blockText}`,
          KINDS_FROM_BLOCK_SYSTEM
        );
        const obj = result.rows[0];
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          const kinds = Array.isArray(obj.kinds) ? (obj.kinds as RawKind[]) : [];
          const notas =
            typeof obj.notas_globales === "string" ? obj.notas_globales : "";
          return { kinds, notas_globales: notas };
        }
      } catch {
        if (attempt === 1) return null;
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
    return null;
  };

  // ---- Step 1: process file/text → populate kinds + preview rows ----
  // Wrapper for the "Procesar archivo" button. Validates that the batch
  // has agent + validity filled BEFORE running the (paid) extraction —
  // otherwise the rates that come back inherit empty defaults and every
  // row gets flagged for stale reasons. A modal walks the user through
  // the missing fields and focuses the first one on dismiss.
  const handleProcessClick = () => {
    const missing: string[] = [];
    if (!effectiveAgent.trim()) missing.push("agente");
    if (!effectiveValidity) missing.push("validez");
    if (missing.length > 0) {
      setValidationModal({
        fields: missing,
        focusTarget: missing[0] === "agente" ? "agent" : "validity",
      });
      return;
    }
    void processInput();
  };

  // Pipeline: extract → detect kinds → second-pass kinds from right block →
  // sweep free-text → expand multi-carrier → apply user-input precedence for
  // agent/validity → flag negative SF → set previewRows. The user reviews the
  // detected kinds in Step 1 and clicks "Continuar al preview" to see the
  // table in Step 2.
  const processInput = async () => {
    if (!hasInput) {
      setError("Subí un archivo o pegá texto con las tarifas.");
      return;
    }
    setLoading(true);
    setError(null);
    setExtractionInfo(null);
    try {
      let extracted: ExtractedBatch = { rates: [] };

      // ---- Pre-LLM client-side preprocessing (Fix 4 + Fix 5) ----
      //
      // Two passes happen BEFORE we call the rate-extraction LLM so the
      // model never sees lines that we already know belong elsewhere:
      //
      //   Fix 5 (precarriage): "Inland FCA Mendoza 20 = USD 2250" /
      //   "FCA Haulage San Martín to Chile = 2270" → emitted directly
      //   as kinds (precarriage_<city>). The line is stripped from the
      //   text so RATE_SYSTEM doesn't try to parse it as a maritime rate
      //   blocked by pod_missing.
      //
      //   Fix 4 (sub-client suffix): "Thermal Liner S&F Chile (ASC -
      //   Aussino - EMW) = 180/280" → emitted as a note line for the
      //   batch ("Cliente ASC-Aussino-EMW: Thermal Liner S&F Chile
      //   180/280") and stripped from the text so KIND_FROM_BLOCK_SYSTEM
      //   doesn't treat it as a duplicate kind value. The general
      //   "Thermal Liner S&F Chile" stays in the source for normal kind
      //   detection.
      //
      // Order MUST be Fix 5 → Fix 4 → Fix 3, because "FCA Haulage Mendoza
      // to Chile" begins with "FCA" which is one of Fix 3's prefix
      // triggers — if we evaluated Fix 3 first the line would land on
      // rates[] as a maritime FCA rate blocked POD missing.
      const precarriageHits = detectPrecarriageInline(
        pasteText || docxText || ""
      );
      const subClientResult = detectSubClientSuffixes(
        pasteText || docxText || ""
      );
      // Excel kindsBlock uses pipe-separated rows (Label | val20 | val40)
      // which the email-style detectors don't match — they require "=".
      // detectExcelBlockKinds adapts the format and runs the same
      // detectors on synthetic per-column lines. Returns the hits + the
      // ORIGINAL (pipe-format) raw lines that need to be stripped from
      // the block before it goes to the LLM.
      const excelBlockResult = detectExcelBlockKinds(excelKindsBlock);
      const allRawLinesToStrip = new Set<string>([
        ...precarriageHits.map((h) => h.rawLine.trim()),
        ...subClientResult.rawLines.map((l) => l.trim()),
        ...excelBlockResult.rawLinesToStrip,
      ]);
      const stripCapturedLines = (s: string): string => {
        if (!s || allRawLinesToStrip.size === 0) return s;
        return s
          .split(/\r?\n/)
          .filter((l) => !allRawLinesToStrip.has(l.trim()))
          .join("\n");
      };
      const cleanedPasteText = stripCapturedLines(pasteText);
      const cleanedDocxText = stripCapturedLines(docxText);
      const cleanedExcelKindsBlock = stripCapturedLines(excelKindsBlock);
      const allPrecarriageHits = [
        ...precarriageHits,
        ...excelBlockResult.precarriageHits,
      ];
      const allSubClientNotes = [
        ...subClientResult.noteLines,
        ...excelBlockResult.subClientNotes,
      ];

      // Fix 1: Excluded-kind phrases ("Doesn't included Disposal USD 190")
      // sit inside Comments column cells on the rate-shaped sheet (KATAOKA
      // fixture). They name a kind that's NOT bundled into SF AND carry
      // its USD value. The Bundle 2 strategy: detect them up-front (so we
      // know which kinds need to materialise globally), but DO NOT strip
      // them from the Excel text fed to the LLM. Letting the LLM see the
      // phrase in the Comments cell makes it route the comment into the
      // rate's notas, which we later scan to tag affected_rate_ids on the
      // matching kind and to clean the per-row notes (Fix 2 spillover).
      // Paste / docx / kindsBlock still use the sanitized text — those
      // sources don't have a per-row structure so the kind stays global.
      const excludedFromExcel = detectExcludedKindsFromText(excelText);
      const excludedFromPaste = detectExcludedKindsFromText(cleanedPasteText);
      const excludedFromDocx = detectExcludedKindsFromText(cleanedDocxText);
      const excludedFromKindsBlock = detectExcludedKindsFromText(
        cleanedExcelKindsBlock
      );
      const cleanedPasteTextFinal = excludedFromPaste.sanitizedText;
      const cleanedDocxTextFinal = excludedFromDocx.sanitizedText;
      const cleanedExcelKindsBlockFinal =
        excludedFromKindsBlock.sanitizedText;
      // Dedupe excluded-kind hits across sources by (kindId|value) so the
      // same phrase showing up in both excelText and excelKindsBlock
      // doesn't double-count.
      const excludedKindHitsMap = new Map<
        string,
        (typeof excludedFromExcel.hits)[number]
      >();
      for (const h of [
        ...excludedFromExcel.hits,
        ...excludedFromPaste.hits,
        ...excludedFromDocx.hits,
        ...excludedFromKindsBlock.hits,
      ]) {
        const key = `${h.kindId}|${h.value}`;
        if (!excludedKindHitsMap.has(key)) excludedKindHitsMap.set(key, h);
      }
      const allExcludedKindHits = Array.from(excludedKindHitsMap.values());
      // Track which excluded-kind hits originated from the Excel rate
      // pipeline. Only those get per-row affected_rate_ids tagging — paste
      // and docx hits stay global (no per-row structure to correlate).
      const excelExcludedKindIds = new Set(
        excludedFromExcel.hits.map((h) => h.kindId)
      );

      if (excelText) {
        // LCL + catalog sheets were already filtered out at read time —
        // excelText only contains rate-classified sheet content. The raw
        // text reaches the LLM intact (Fix 1 needs phrases preserved on
        // their originating rows).
        const chunks = chunkExcelCsv(excelText);
        const items = chunks.map((c, i) => ({
          index: i + 1,
          content: `Datos del Excel (bloque ${i + 1} de ${chunks.length}):\n\n${c}`,
        }));
        setChunkProgress({ current: 0, total: chunks.length });
        const result = await processChunks(items, chunks.length);
        setChunkProgress(null);
        extracted = collectBatchFromChunks(result.rows);
        if (result.failed.length > 0) {
          setError(
            `Bloques fallidos tras 3 reintentos: ${result.failed.join(", ")}. ${extracted.rates.length} tarifas extraídas.`
          );
        }
      } else if (imageData) {
        const isPdf = imageData.mediaType === "application/pdf";
        const content: ContentPayload = [
          {
            type: isPdf ? "document" : "image",
            source: {
              type: "base64",
              media_type: imageData.mediaType,
              data: imageData.base64,
            },
          },
          {
            type: "text",
            text: isPdf
              ? "Extraé las tarifas del PDF según las instrucciones del system."
              : "Extraé las tarifas de la imagen según las instrucciones del system.",
          },
        ];
        const result = await callExtractApi(content, RATE_SYSTEM);
        extracted = collectBatchFromChunks(result.rows);
      } else if (cleanedDocxTextFinal) {
        const result = await callExtractApi(
          `Contenido del documento Word:\n\n${cleanedDocxTextFinal}`,
          RATE_SYSTEM
        );
        extracted = collectBatchFromChunks(result.rows);
      } else if (cleanedPasteTextFinal.trim()) {
        const result = await callExtractApi(cleanedPasteTextFinal, RATE_SYSTEM);
        extracted = collectBatchFromChunks(result.rows);
      }

      // Detect kinds + values from the extracted rate rows.
      const detected = detectKindsFromExtracted(extracted.rates);

      // Second pass: extract kinds from the source text using the
      // KINDS_FROM_BLOCK_SYSTEM prompt. Sources that get this pass:
      //   - excelKindsBlock (catalog sheets + right-side blocks of rate
      //     sheets — captured by classifySheet at read time)
      //   - pasteText (full email body)
      //   - docxText (Word document text)
      // Image / PDF inputs go through the vision-capable RATE_SYSTEM in
      // a single pass, so they don't need this second call. Running the
      // text-only haiku prompt over the full email recovers free-text
      // patterns like "Flexitank Chile = USD 600" / "Inland FCA Mendoza
      // 20 = USD 2250" that RATE_SYSTEM often missed.
      const kindsSourceText =
        cleanedExcelKindsBlockFinal.trim() ||
        (cleanedPasteTextFinal.trim() ? cleanedPasteTextFinal.trim() : "") ||
        (cleanedDocxTextFinal.trim() ? cleanedDocxTextFinal.trim() : "");
      let extraNotas = "";
      if (kindsSourceText) {
        const blockResult = await extractKindsFromBlock(kindsSourceText);
        if (blockResult) {
          const blockDetected = detectKindsFromExtracted([
            { kinds: blockResult.kinds } as RawRate,
          ]);
          for (const def of blockDetected.kinds) {
            if (!detected.kinds.some((k) => k.id === def.id)) {
              detected.kinds.push(def);
            }
          }
          for (const kv of blockDetected.kindValues) {
            if (!detected.kindValues.some((v) => v.kind_id === kv.kind_id)) {
              detected.kindValues.push(kv);
            }
          }
          // Preferential entries from the second pass merge with the first.
          detected.preferentialEntries.push(...blockDetected.preferentialEntries);
          if (blockResult.notas_globales) extraNotas = blockResult.notas_globales;
        }
      }

      // Defense-in-depth sweep: regex over notas_globales + kinds block
      // + paste/docx text + per-rate notas to recover kinds that neither
      // pass picked up. Only adds kinds whose ids aren't already present.
      const sweepText = [
        extracted.notas_globales ?? "",
        extraNotas,
        cleanedExcelKindsBlockFinal,
        cleanedPasteTextFinal,
        cleanedDocxTextFinal,
        ...extracted.rates.map((r) => toStr(r.notas ?? r.notes)),
      ]
        .filter(Boolean)
        .join("\n");
      const sweepResult = sweepKindsFromText(sweepText, detected.kinds);
      detected.kinds.push(...sweepResult.kinds);
      detected.kindValues.push(...sweepResult.kindValues);

      // Merge excluded-kind hits captured by the Fix 1 sweep (KATAOKA
      // Comments column phrases like "Doesn't included Disposal USD
      // 190"). When the kind already exists in detected.kinds (e.g. the
      // LLM saw "Disposal" as a label without a value), update the
      // existing entry's value_unique. Otherwise emit a new kind def
      // (predefined when matchKindByAlias resolved, custom otherwise).
      for (const hit of allExcludedKindHits) {
        const existing = detected.kinds.find((k) => k.id === hit.kindId);
        if (!existing) {
          const pred = PREDEFINED_KINDS.find((p) => p.id === hit.kindId);
          const def: KindDef = pred ?? {
            id: hit.kindId,
            label: hit.kindLabel,
            scope: "all",
            by_size: false,
            predefined: false,
          };
          detected.kinds.push(def);
          detected.kindValues.push({
            kind_id: hit.kindId,
            value_unique: hit.value,
          });
        } else {
          let kv = detected.kindValues.find((v) => v.kind_id === hit.kindId);
          if (!kv) {
            kv = { kind_id: hit.kindId };
            detected.kindValues.push(kv);
          }
          if (existing.by_size) {
            if (kv.value20 === undefined) kv.value20 = hit.value;
            if (kv.value40 === undefined) kv.value40 = hit.value;
          } else if (kv.value_unique === undefined) {
            kv.value_unique = hit.value;
          }
        }
      }

      // Merge precarriage hits captured by the client-side regex pre-pass
      // (Fix 5). When multiple hits target the same kind id, accumulate
      // value20 / value40 so a "Mendoza 20 = 2250" + "Mendoza 40 = 2350"
      // pair collapses to a single by_size kind. Hits without a size
      // qualifier default to value20.
      for (const hit of allPrecarriageHits) {
        const existingIdx = detected.kinds.findIndex(
          (k) => k.id === hit.kindId
        );
        if (existingIdx === -1) {
          const pred = PREDEFINED_KINDS.find((p) => p.id === hit.kindId);
          const def: KindDef = pred ?? {
            id: hit.kindId,
            label: hit.kindLabel,
            scope: "all",
            by_size: true,
            predefined: false,
          };
          detected.kinds.push(def);
          const kv: KindValue = { kind_id: hit.kindId };
          if (hit.size === 40) kv.value40 = hit.value;
          else kv.value20 = hit.value;
          detected.kindValues.push(kv);
        } else {
          let kv = detected.kindValues.find((v) => v.kind_id === hit.kindId);
          if (!kv) {
            kv = { kind_id: hit.kindId };
            detected.kindValues.push(kv);
          }
          if (hit.size === 40) {
            if (kv.value40 === undefined) kv.value40 = hit.value;
          } else {
            if (kv.value20 === undefined) kv.value20 = hit.value;
          }
        }
      }

      // Final dedupe pass: drop custom kinds that shadow a predefined one
      // (Van Moer / CCL regression where the LLM emitted both
      // flexitank_chile predef AND a custom "Flexitank Chile" with the same
      // value). The dedupe also merges any non-conflicting values from the
      // dropped custom into the predef.
      const deduped = dedupeKindsAgainstPredefined(
        detected.kinds,
        detected.kindValues
      );
      setBatchKinds(deduped.kinds);
      setBatchKindValues(deduped.values);

      // Apply user-input precedence: only set inferred slots if user fields
      // are still empty. Never overwrite a non-empty user field.
      if (extracted.agent_inferred && !agent.trim()) {
        setAgentInferred(extracted.agent_inferred);
      }
      if (extracted.validity_inferred && !validFrom && !validTo) {
        setValidityInferred(extracted.validity_inferred);
      }
      // Consolidate inferred batch-level notas (preferential-client lines,
      // notas_globales from rate extraction, notas from the right-block
      // pass) and APPEND them directly to the user's batchNotas textarea.
      // The user gets to edit/delete in place — no extra "Usar" click.
      // On a re-process we first strip the previously auto-inserted block
      // (when batchNotas still ends with it verbatim) so the user's manual
      // edits are preserved and we don't accumulate duplicates.
      const preferentialLines = consolidatePreferentialNotes(
        detected.preferentialEntries
      );
      // Regex sweep for the only free-text pattern that's billing-
      // relevant: regional add-ons ("Add / Additional San Carlos US$ 200
      // on top of Mendoza"). Other context that the structured prompts
      // sometimes emit (free days, market changes, EBS-not-included
      // repeat-stamps, "all water via Caucedo") is operationally
      // useful but does not affect the rate amounts we charge — the
      // textarea defaults to empty so the user only sees content
      // they care about.
      const fullText = [
        excelText,
        cleanedExcelKindsBlockFinal,
        cleanedPasteTextFinal,
        cleanedDocxTextFinal,
        ...extracted.rates.map((r) => toStr(r.notas ?? r.notes)),
      ]
        .filter(Boolean)
        .join("\n");
      const regionalAddons = detectRegionalAddons(fullText);
      if (regionalAddons.length > 0 && typeof console !== "undefined") {
        console.log(
          `[rate-extract] regional add-ons captured (${regionalAddons.length}):`,
          regionalAddons
        );
      }
      // Free-day mentions are billing-relevant operational notes (not
      // surcharges). Capture them via a small regex sweep over the
      // unfiltered source so they survive the blacklist filter applied
      // a few lines below.
      const freeDayMatches: string[] = [];
      const freeDayCombined = [
        excelText,
        excelKindsBlock,
        pasteText,
        docxText,
        extracted.notas_globales ?? "",
        extraNotas,
      ]
        .filter(Boolean)
        .join("\n");
      const freeDayRe =
        /^[^\n]*\b\d+(?:\s*\/\s*\d+)?\s+free\s+days?\b[^\n]*$/gim;
      let fdm: RegExpExecArray | null;
      const seenFreeDay = new Set<string>();
      while ((fdm = freeDayRe.exec(freeDayCombined)) !== null) {
        const line = fdm[0].trim();
        const k = line.toLowerCase();
        if (line && !seenFreeDay.has(k)) {
          seenFreeDay.add(k);
          freeDayMatches.push(line);
        }
      }
      const combinedNotasGlobalesRaw = [
        ...preferentialLines,
        ...allSubClientNotes,
        ...regionalAddons,
        ...freeDayMatches,
      ]
        .filter((s) => s && s.trim())
        .join("\n")
        .trim();
      // Final defense: drop any line that matches the batch-notes
      // blacklist (saludations, narrative, validity, EBS/BL Fee, section
      // headers, etc.). Whitelist patterns inside filterBatchNotesText
      // protect free-day / regional / sub-client lines.
      const combinedNotasGlobales =
        filterBatchNotesText(combinedNotasGlobalesRaw);
      if (combinedNotasGlobales) {
        setBatchNotas((prev) => {
          let base = prev;
          if (
            lastAutoInsertedNotes &&
            base.trimEnd().endsWith(lastAutoInsertedNotes)
          ) {
            // Find the last occurrence of the auto-inserted block at the end
            // (allowing for trailing whitespace) and strip it cleanly.
            const idx = base.lastIndexOf(lastAutoInsertedNotes);
            base = base.slice(0, idx).replace(/\n+\s*$/, "");
          }
          if (!base.trim()) return combinedNotasGlobales;
          return `${base.trimEnd()}\n\n${combinedNotasGlobales}`;
        });
        setLastAutoInsertedNotes(combinedNotasGlobales);
        setShowAutoInsertBanner(true);
      } else {
        // Nothing inferred this round — clear the tracker so a future run
        // doesn't accidentally strip user-typed text that happened to match
        // a stale value.
        setLastAutoInsertedNotes("");
        setShowAutoInsertBanner(false);
      }

      // Pre-expansion order matters: equipment combos first (so a
      // multi-POD row carrying "20'Flexi/DC" produces 4 rows after
      // POD split, not 2), then multi-POD, then multi-carrier. Each
      // pass operates on rows produced by the prior pass — a row with
      // type="20'Flexi/DC", pod="Antwerp/Rotterdam", sl="OOCL or CMA"
      // ends up as 2 (eq) × 2 (pod) × 2 (carrier) = 8 distinct rates.
      const equipmentExpanded = expandCombinedEquipment(extracted.rates);
      const podExpanded = expandMultiPod(equipmentExpanded);
      // Multi-carrier rows clone into one row per carrier.
      const expanded = expandMultiCarrier(podExpanded);
      // Telemetry — surface the deltas at each expansion stage so smoke
      // tests can confirm IWS-style multi-POD / equipment-combo / multi-
      // carrier handling without inspecting individual rows.
      if (typeof console !== "undefined") {
        const eqDelta = equipmentExpanded.length - extracted.rates.length;
        const podDelta = podExpanded.length - equipmentExpanded.length;
        const carrierDelta = expanded.length - podExpanded.length;
        if (eqDelta || podDelta || carrierDelta) {
          console.log("[rate-extract] expansion deltas", {
            initial: extracted.rates.length,
            afterEquipment: equipmentExpanded.length,
            afterPod: podExpanded.length,
            afterCarrier: expanded.length,
            equipmentSplits: eqDelta,
            podSplits: podDelta,
            carrierSplits: carrierDelta,
          });
        }
      }
      // POD inheritance for FCA / EXW Argentine rates: when the batch
      // has a single unique POD across the maritime (non-FCA) rows, an
      // FCA row without an explicit POD inherits it (Valle Redondo
      // pattern). When there's no unique maritime POD, the FCA rows
      // stay POD-empty and the frontend's pod_missing block fires.
      const expandedTyped = expanded.map((r) => ({
        ...r,
        pol: toStr(r.pol),
        pod: toStr(r.pod),
        notas: toStr(r.notas ?? r.notes),
      }));
      const expandedWithPod = inheritPodForFcaRates(expandedTyped);

      // Compute the year hint for date normalization: prefer the year of
      // the batch's effective validity (so "31/6" / "Fin de Junio" land
      // in the user's intended quarter), fall back to current year.
      const batchYearHint =
        (effectiveValidity?.validTo &&
          parseInt(effectiveValidity.validTo.slice(0, 4), 10)) ||
        (effectiveValidity?.validFrom &&
          parseInt(effectiveValidity.validFrom.slice(0, 4), 10)) ||
        new Date().getFullYear();

      // Convert raw rate rows into preview-table records. The needs-review
      // classification is delegated to constants.ts:isRateNeedsReview — see
      // that function for the criteria. SF=0 and SF<0 are PRESERVED as
      // legitimate values; the asian-POD exception lets differential rates
      // through without flagging.
      const previewIdStamp = Date.now();
      const rows: Record<string, unknown>[] = expandedWithPod.map((r, rowIdx) => {
        const rawNotesField = toStr(r.notas ?? r.notes);
        const tipoOut = coerceContainerType(r.type ?? r.tipo);
        const carrier = toStr(r.carrier);
        const sl = toStr(r.sl) || carrier;
        const pol = toStr(r.pol);
        const pod = toStr(r.pod);
        // route stays as a legacy fallback for display when neither pol
        // nor pod is filled. Step 2 / RatesTab render via formatRoute
        // which prefers pol/pod over this string.
        const route = toStr(r.route) || (pol && pod ? `${pol} - ${pod}` : pol || pod);
        // Incoterm: prefer the literal value Claude emitted, then fall
        // back to the geographic / notas heuristic. Always lands on one
        // of the six valid Incoterm values; never undefined. Computed
        // BEFORE baseNotes so cleanIndividualNotes can drop incoterm
        // tokens that the LLM accidentally pushed into the comments
        // column (KATAOKA fixture: "FOB" / "FCA Mendoza" lines).
        const rawIncoterm = toStr(r.incoterm).toUpperCase().trim();
        const validIncoterm = (INCOTERM_OPTIONS as readonly string[]).includes(
          rawIncoterm
        )
          ? (rawIncoterm as Incoterm)
          : null;
        const incoterm: Incoterm =
          validIncoterm ??
          inferIncotermFromContext({
            pol,
            notas: rawNotesField,
          });
        const baseNotes = cleanIndividualNotes(rawNotesField, { incoterm, pol });
        const previewId = `preview-${previewIdStamp}-${rowIdx}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        const sfNum = toNumber(r.sf);
        const sfParseable = isParsableNumber(r.sf);
        // BL Fee: a missing field defaults to 0 ONLY for Asian POD dry
        // routes (where Asian agents commonly bundle BL fee into SF). For
        // non-Asian PODs, missing BL fee stays unparseable so the row
        // gets flagged for the user to fill — guards against accidentally
        // saving a $0 BL fee when the email simply didn't mention one.
        const rawBlFeeField = r.bl_fee ?? r.blFee;
        const blFeeMissing =
          rawBlFeeField === undefined || rawBlFeeField === null;
        const blFeeRaw = blFeeMissing
          ? isAsianPod(pod)
            ? 0
            : ""
          : rawBlFeeField;
        const blFeeNum = toNumber(blFeeRaw);
        const blFeeParseable = isParsableNumber(blFeeRaw);
        // Per-row validity is intentionally IGNORED — Inter-Tank rates
        // always inherit the batch's Q1/Q2/Q3/Q4 (or explicit date range)
        // from Step 1. Even when a source mentions "Validity 30/6" or
        // "valid until X" per row, that's discarded. The user creates a
        // separate batch when the validity actually differs.

        const noteParts: string[] = [];
        if (baseNotes) noteParts.push(baseNotes);
        if (tipoOut.note) noteParts.push(tipoOut.note);
        if (!sfParseable && (pol.trim() || pod.trim() || carrier)) {
          noteParts.push("⚠️ SF faltante en archivo — completar manualmente.");
        }
        if (blFeeMissing && !isAsianPod(pod)) {
          noteParts.push("⚠️ BL Fee no detectado — confirmar con el agente.");
        }
        // EBS / EFS / BAF mentions in extracted notes are noise — Inter-
        // Tank always bills them separately via the EBS table. No note
        // is emitted; nothing to defend frontend-side.

        // Expired-validity note is a BATCH-level concern. The flag
        // lands on every row only because we don't have a separate
        // batch banner today; cleanup pending until the per-row vs
        // batch UI is split.
        const effTo = effectiveValidity?.validTo ?? "";
        if (effTo && isDateInPast(effTo, batchYearHint)) {
          noteParts.push(`⚠️ Validez del batch vencida: ${formatDateCl(effTo)}`);
        }

        // Range-band check. Reefer SFs outside 999-10000 are blocked
        // (almost always typos or Thermal Liner kind values misread as
        // a rate row); Dry/Flexi out-of-range yield warnings the user
        // can dismiss by simply saving.
        let rangeFlag: RateRangeFlag | null = validateRateRange({
          tipo: tipoOut.tipo,
          sf: sfNum,
        });

        // Phantom-rate defense (generalized Fix B): when a rate row has
        // an empty carrier AND its sf exactly matches a detected kind
        // value, treat it as a kind that leaked into rates[]. Covers
        // Flexitank Chile/Arg → 20'Flexi phantom, Inland FCA Mendoza →
        // 20'Dry/40'Dry phantom, Insulado → 40'Reefer phantom, Agency
        // Fee → phantom, etc. Carrier-empty is the strong signal —
        // legitimate rates always have a carrier.
        if (!carrier.trim()) {
          for (const def of detected.kinds) {
            const kv = detected.kindValues.find((v) => v.kind_id === def.id);
            if (!kv) continue;
            if (
              kv.value20 === sfNum ||
              kv.value40 === sfNum ||
              kv.value_unique === sfNum
            ) {
              const matchedValue =
                kv.value20 === sfNum
                  ? `${kv.value20} (20')`
                  : kv.value40 === sfNum
                    ? `${kv.value40} (40')`
                    : `${kv.value_unique}`;
              rangeFlag = {
                severity: "blocking",
                message: `SF=${sfNum} matchea el kind ${def.label} = ${matchedValue} y la rate tiene carrier vacío. Probable kind extraído como rate fantasma — verificá tipo, ruta y monto antes de guardar.`,
              };
              break;
            }
          }
        }

        // Phantom-rate defense (Fix C): emails sometimes have POL/POD
        // emitted as a country / region label ("Chile", "Argentina",
        // "Mendoza") when the source had no actual port. Block those —
        // a real rate always has a port name. The user can edit the
        // POL/POD inline to clear the flag if it's a legitimate rate
        // they want to save.
        if (!rangeFlag && (isCountryNotPort(pol) || isCountryNotPort(pod))) {
          const offending = isCountryNotPort(pol)
            ? `POL="${pol}"`
            : `POD="${pod}"`;
          rangeFlag = {
            severity: "blocking",
            message: `${offending} es un país / región, no un puerto. Probable POL/POD inferido erróneamente — completá con el puerto real o eliminá la rate.`,
          };
        }

        if (rangeFlag) {
          noteParts.push(
            (rangeFlag.severity === "blocking" ? "🚫 " : "⚠️ ") +
              rangeFlag.message
          );
        }

        const notes = noteParts.join("\n");
        const bundle = detectBundleInclusions(notes);
        const finalNotes = bundle ? notes : notes;
        const needsReview = isRateNeedsReview(
          {
            pol,
            pod,
            tipo: tipoOut.tipo,
            tipoCoerced: !!tipoOut.note,
            sfNum,
            blFeeNum,
            sfParseable,
            blFeeParseable,
          },
          effectiveValidity,
          batchYearHint
        );
        const carrierMissing = !carrier.trim();
        const podMissing = !pod.trim();
        // Carrier and POD are REQUIRED. Empty either field is a hard
        // block — Inter-Tank doesn't accept rates without a carrier or
        // a destination port. The user fixes both via the inline edit
        // row; updatePreviewField re-evaluates the entire blocking
        // chain on every keystroke so when a field is filled the next
        // unsatisfied condition (if any) becomes the active block.
        let blockingMessage: string | null = null;
        let blockingType: string | null = null;
        if (rangeFlag?.severity === "blocking") {
          blockingMessage = rangeFlag.message;
          if (
            rangeFlag.message.includes("kind") &&
            rangeFlag.message.includes("rate fantasma")
          ) {
            blockingType = "phantom_kind";
          } else if (
            rangeFlag.message.includes("país") ||
            rangeFlag.message.includes("región")
          ) {
            blockingType = "country_not_port";
          } else if (rangeFlag.message.includes("Reefer")) {
            blockingType = "reefer_range";
          }
        }
        if (!blockingMessage && carrierMissing) {
          blockingMessage =
            "Carrier requerido — completá manualmente para guardar.";
          blockingType = "carrier_missing";
        }
        if (!blockingMessage && podMissing) {
          blockingMessage =
            "Puerto de destino (POD) requerido — completá manualmente para guardar.";
          blockingType = "pod_missing";
        }
        return {
          // Stable preview-row id assigned at extraction time. Used by
          // Fix 1 (affected_rate_ids) to track which rates a given
          // excluded-kind hit applies to — and reused as the saved
          // Rate.id at buildRateFromRow time so the link survives the
          // commit. Multi-carrier expansion in commitAndCloseEdit
          // generates fresh ids for clones.
          _id: previewId,
          // Raw Comments-column content from the LLM, BEFORE
          // cleanIndividualNotes stripped excluded-kind phrases /
          // incoterm tokens. Held only for the immediate post-build
          // affected_rate_ids scan and deleted right after — never
          // reaches Step 2 render or buildRateFromRow.
          _rawComments: rawNotesField,
          carrier,
          pol,
          pod,
          route,
          tipo: tipoOut.tipo,
          incoterm,
          sl,
          sf: sfNum,
          blFee: blFeeNum,
          notes: finalNotes,
          // _needsReview includes blocking rows so the Step 2 banner
          // counts them in "Requieren revisión" alongside soft warnings.
          // The blocking visual (red bg) takes precedence over the
          // warning visual (amber) at render time.
          _needsReview: needsReview || !!blockingMessage,
          _blockingError: blockingMessage,
          _blockingType: blockingType,
          _uncheckByDefault: !!blockingMessage,
        };
      });

      // Fix 1 second pass: tag affected_rate_ids on excluded kinds. Two
      // complementary signals feed the same affectedByKindId map so a
      // hit found by either source reaches the kind:
      //
      //   (a) row._rawComments — the LLM's notas string verbatim. Works
      //       only when Claude propagated the source Comments cell to
      //       notas (which happens for short / single-sentence cells).
      //   (b) excelText line-by-line — the raw CSV from the rate sheet,
      //       parsed directly without LLM mediation. KATAOKA's Comments
      //       cell is long enough that Claude often summarises it and
      //       drops the "Doesn't included Disposal USD 190" tail; scanning
      //       the source line ourselves recovers the per-row attribution.
      //
      // Each excelText line carrying a hit gets correlated to a preview
      // row by identifying fields (sf as the primary key, plus carrier
      // and pod for tie-breaking). Score 2/3 is enough — Claude commonly
      // rewrites carrier names ("OOCL" vs "OOCL Lines") so we tolerate
      // one missing match.
      const affectedByKindId = new Map<string, Set<string>>();
      // (a) _rawComments scan
      if (excelExcludedKindIds.size > 0) {
        for (const row of rows) {
          const raw = String(row._rawComments ?? "");
          if (!raw) continue;
          const detect = detectExcludedKindsFromText(raw);
          if (detect.hits.length === 0) continue;
          for (const hit of detect.hits) {
            if (!excelExcludedKindIds.has(hit.kindId)) continue;
            let set = affectedByKindId.get(hit.kindId);
            if (!set) {
              set = new Set<string>();
              affectedByKindId.set(hit.kindId, set);
            }
            set.add(String(row._id));
          }
        }
      }
      // (b) excelText line-by-line scan + correlation. Strict AND: every
      // non-empty identifying field on the rate (carrier, pod, sf) must
      // appear in the source line for the line to claim that rate. The
      // earlier 2-of-3 score was too lax — KATAOKA's 23 OOCL/Yokohama
      // rates all matched on (carrier+pod) even though only 3 carried
      // the Disposal phrase, leading to "14 rates tagged" when 3 was
      // correct. Strict AND prefers false negatives over false positives.
      // Also gate on at least 2 fields populated to avoid taggings driven
      // by a single weak signal.
      if (excelText && excelExcludedKindIds.size > 0) {
        const linesWithHits: Array<{
          rawLine: string;
          hits: ReturnType<typeof detectExcludedKindsFromText>["hits"];
        }> = [];
        for (const line of excelText.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("Hoja:")) continue;
          const detect = detectExcludedKindsFromText(trimmed);
          if (detect.hits.length > 0) {
            linesWithHits.push({ rawLine: trimmed, hits: detect.hits });
          }
        }
        if (linesWithHits.length > 0) {
          for (const row of rows) {
            const carrier = String(row.carrier ?? "").trim();
            const pod = String(row.pod ?? "").trim();
            const sfNum = Number(row.sf ?? 0);
            const hasCarrier = carrier.length > 0;
            const hasPod = pod.length > 0;
            const hasSf = Number.isFinite(sfNum) && sfNum !== 0;
            const fieldsPresent =
              (hasCarrier ? 1 : 0) + (hasPod ? 1 : 0) + (hasSf ? 1 : 0);
            // Skip rates we cannot identify by at least 2 fields — a
            // single match (carrier alone, or sf alone) isn't enough to
            // discriminate between siblings on the same lane.
            if (fieldsPresent < 2) continue;
            const carrierLower = carrier.toLowerCase();
            const podLower = pod.toLowerCase();
            // Word-bounded SF match that excludes thousand-separator
            // siblings: "750" must not match the "750" inside "24,750".
            // The anchor uses non-digit / non-comma / non-dot on either
            // side of the literal value.
            const sfPattern = hasSf
              ? new RegExp(`(?:^|[^\\d.,])${sfNum}(?:[^\\d.,]|$)`)
              : null;
            for (const { rawLine, hits } of linesWithHits) {
              const lineLower = rawLine.toLowerCase();
              if (hasCarrier && !lineLower.includes(carrierLower)) continue;
              if (hasPod && !lineLower.includes(podLower)) continue;
              if (sfPattern && !sfPattern.test(rawLine)) continue;
              for (const hit of hits) {
                if (!excelExcludedKindIds.has(hit.kindId)) continue;
                let set = affectedByKindId.get(hit.kindId);
                if (!set) {
                  set = new Set<string>();
                  affectedByKindId.set(hit.kindId, set);
                }
                set.add(String(row._id));
              }
              break;
            }
          }
        }
      }
      if (affectedByKindId.size > 0) {
        setBatchKinds((prev) =>
          prev.map((k) => {
            const ids = affectedByKindId.get(k.id);
            if (!ids || ids.size === 0) return k;
            return { ...k, affected_rate_ids: Array.from(ids) };
          })
        );
      }
      // Debug telemetry — surface the scan outcome in the browser console
      // so smoke tests can confirm KATAOKA's "🔗 3 de 23" without opening
      // the kind editor. One line per kind that received at least one
      // affected rate.
      if (typeof console !== "undefined") {
        if (affectedByKindId.size === 0) {
          if (excelExcludedKindIds.size > 0) {
            console.log(
              `[excluded-kinds-scan] 0 rates correlated for ${excelExcludedKindIds.size} excluded kind(s) detected globally`
            );
          }
        } else {
          for (const [kindId, ids] of affectedByKindId) {
            console.log(
              `[excluded-kinds-scan] ${ids.size} rate(s) tagged for kind=${kindId}`
            );
          }
        }
      }
      for (const row of rows) {
        delete row._rawComments;
      }

      // Drop phantom rate rows (kind-leaks) from the preview entirely.
      // _blockingType === "phantom_kind" is set by the row converter when
      // the rate has no carrier AND its SF matches the value of a
      // predefined kind in the batch — that's a Flexitank / Insulado /
      // Agency Fee line that Claude misclassified as a rate. Showing them
      // as red blocked rows just adds noise; the kind itself is already
      // captured (Fix A dedupe ensures the kind catalog has it once).
      const visibleRows = rows.filter(
        (r) => r._blockingType !== "phantom_kind"
      );
      setPreviewRows(visibleRows);
      // Default selection excludes blocked rows + carrier-missing rows.
      // The user can manually re-check them after editing in Step 2.
      setPreviewSelected(
        new Set(
          visibleRows
            .map((r, i) => ({ r, i }))
            .filter(({ r }) => !r._uncheckByDefault)
            .map(({ i }) => i)
        )
      );
      setExtractionDone(true);

      // Surface non-blocking info (sheet classifications, kinds + rates count).
      const infoParts: string[] = [];
      const lclSheets = excelSheetClassifications
        .filter((c) => c.type === "lcl")
        .map((c) => c.name);
      const catalogSheets = excelSheetClassifications
        .filter((c) => c.type === "catalog")
        .map((c) => c.name);
      if (lclSheets.length > 0) {
        infoParts.push(
          `${lclSheets.length} hoja${lclSheets.length === 1 ? "" : "s"} LCL skipeada${lclSheets.length === 1 ? "" : "s"} (${lclSheets.join(", ")})`
        );
      }
      if (catalogSheets.length > 0) {
        infoParts.push(
          `${catalogSheets.length} hoja${catalogSheets.length === 1 ? "" : "s"} catálogo (${catalogSheets.join(", ")})`
        );
      }
      infoParts.push(
        `${detected.kinds.length} kind${detected.kinds.length === 1 ? "" : "s"} detectado${detected.kinds.length === 1 ? "" : "s"}, ${rows.length} tarifa${rows.length === 1 ? "" : "s"} extraída${rows.length === 1 ? "" : "s"}.`
      );
      setExtractionInfo(infoParts.join(" · "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al extraer datos");
    } finally {
      setLoading(false);
    }
  };

  // ---- Kinds editor handlers ----
  const addKind = (def: KindDef) => {
    setBatchKinds((prev) =>
      prev.some((k) => k.id === def.id) ? prev : [...prev, def]
    );
    setBatchKindValues((prev) =>
      prev.some((kv) => kv.kind_id === def.id) ? prev : [...prev, { kind_id: def.id }]
    );
  };
  const removeKind = (id: string) => {
    setBatchKinds((prev) => prev.filter((k) => k.id !== id));
    setBatchKindValues((prev) => prev.filter((kv) => kv.kind_id !== id));
  };
  const updateKindDef = (id: string, patch: Partial<KindDef>) => {
    setBatchKinds((prev) =>
      prev.map((k) => (k.id === id ? { ...k, ...patch } : k))
    );
  };
  const updateKindValue = (id: string, patch: Partial<KindValue>) => {
    setBatchKindValues((prev) =>
      prev.map((kv) => (kv.kind_id === id ? { ...kv, ...patch } : kv))
    );
  };

  // ---- Save flow ----
  const buildRateFromRow = (
    row: Record<string, unknown>,
    common: {
      agent: string;
      validFrom: string;
      validTo: string;
    },
    idx: number,
    kinds: KindDef[],
    kindValues: KindValue[]
  ): Rate => {
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    // Reuse the stable preview id when present so kinds with
    // affected_rate_ids continue to reference the right rate after
    // commit. Falls back to a fresh id for legacy paths (edit-mode
    // single rate, or rows that were cloned via commitAndCloseEdit
    // without an id assignment).
    const previewId = toStr(row._id);
    const finalId = previewId || `rate-${stamp}-${idx}-${rand}`;
    const tipoRaw = toStr(row.tipo);
    const tipoOut = CONTAINER_TYPES.includes(tipoRaw as ContainerType)
      ? { tipo: tipoRaw as ContainerType, note: undefined as string | undefined }
      : (() => {
          const m = migrateContainerType(tipoRaw);
          return { tipo: m.tipo, note: m.note };
        })();
    const baseNotes = toStr(row.notes);
    const notes = tipoOut.note
      ? baseNotes
        ? `${baseNotes}\n${tipoOut.note}`
        : tipoOut.note
      : baseNotes;
    const trimmedBatchNotas = batchNotas.trim();
    // Incoterm: trust the row's already-resolved value (set by the row
    // converter in processInput, with Claude's literal + heuristic
    // fallback). The inline edit row also writes this field via the
    // dropdown, so by the time we get here it's always one of the six
    // valid Incoterms. Defensive fallback: re-infer from the saved
    // pol/notas if for some reason it's missing.
    const rowIncoterm = toStr(row.incoterm).toUpperCase().trim();
    const incoterm: Incoterm = (
      INCOTERM_OPTIONS as readonly string[]
    ).includes(rowIncoterm)
      ? (rowIncoterm as Incoterm)
      : inferIncotermFromContext({
          pol: toStr(row.pol),
          notas: notes,
        });
    return {
      id: finalId,
      agent: common.agent.trim(),
      carrier: toStr(row.carrier),
      pol: toStr(row.pol),
      pod: toStr(row.pod),
      route: toStr(row.route),
      tipo: tipoOut.tipo,
      incoterm,
      sl: toStr(row.sl) || toStr(row.carrier),
      sf: toNumber(row.sf),
      blFee: toNumber(row.blFee),
      af: 0,
      afMax: 0,
      flexiArg: 0,
      kind_values: kindValues.map((kv) => ({ ...kv })),
      kinds: kinds.map((k) => ({ ...k })),
      validFrom: common.validFrom,
      validTo: common.validTo,
      notes,
      notas: notes,
      // Denormalize the batch's globales onto every saved rate so the rate
      // is self-contained for invoicing/listing without needing a batch
      // lookup. Stored once per rate but kept distinct from rate.notes.
      batch_notas_globales: trimmedBatchNotas || undefined,
      additionalCosts: [],
    };
  };

  // Agent alias / Levenshtein suggestion modal state (Fix 4). When the
  // user types an abbreviation that resolves to an existing canonical
  // agent ("WR" → WENRAN, "Wenrn" → WENRAN), the resolver flags it and
  // we surface a confirmation modal before navigating to Step 2 — so the
  // operator can either fold into the existing agent's catalog or
  // explicitly create a new one with the typed name.
  const [agentSuggestion, setAgentSuggestion] = useState<{
    typed: string;
    resolution: AgentResolution;
    canonicalRateCount: number;
  } | null>(null);
  const knownAgentNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of existingRates) {
      const name = r.agent.trim();
      if (name) set.add(name);
    }
    return Array.from(set);
  }, [existingRates]);

  // Bundle 4 — Entity catalog. Loaded once at NewRateFlow level so the
  // pending-agents badge, the cross-check modal, and the suggestion
  // banners can all share a single source of truth. add() is used by
  // the cross-check modal's "Crear agente nuevo" branch.
  const {
    items: entities,
    add: addEntity,
  } = useLocalStore<Entity>(ENTITIES_STORAGE_KEY, ENTITIES_SEED);
  const activeAgentEntities = useMemo(
    () =>
      entities.filter((e) => e.type === "Agente" && e.status === "active"),
    [entities]
  );
  // Comercial lookup keyed by lowercase agent name. Used by
  // PendingAgentsBadge to render the chip and by the suggestion modal to
  // surface the canonical agent's commercial owner.
  const comercialByAgent = useMemo(() => {
    const m = new Map<string, ComercialName>();
    for (const e of entities) {
      if (e.type !== "Agente") continue;
      m.set(e.name.trim().toLowerCase(), e.comercial);
    }
    return m;
  }, [entities]);

  // Bundle 4 — strict cross-check state. When the typed agent isn't
  // present in the entity catalog AND the resolver returns no
  // alias/Levenshtein hit, we surface this modal so the operator either
  // picks an existing entity or creates a new one inline (with the
  // commercial assignment captured). This is the only path that can
  // append to the entity catalog from the rate flow.
  const [crossCheckModal, setCrossCheckModal] = useState<{
    typed: string;
  } | null>(null);

  const continueToPreview = () => {
    if (continueErrors.length > 0) return;
    const typed = effectiveAgent.trim();
    if (typed) {
      // Strict catalog match — alias-aware, case-insensitive. If the
      // typed value resolves to a known catalog entity, we either keep
      // it as-is or rewrite to the catalog's canonical spelling and
      // proceed without prompts.
      const catalogHit = findEntityByAgentName(activeAgentEntities, typed);
      if (catalogHit) {
        if (catalogHit.name !== typed) setAgent(catalogHit.name);
        setStep("preview");
        return;
      }
      const resolution = resolveAgentCanonical(typed, knownAgentNames);
      if (resolution) {
        const sameLetters =
          resolution.canonical.toLowerCase() === typed.toLowerCase();
        if (sameLetters && resolution.canonical !== typed) {
          // Pure casing variant ("bullet" while rate catalog has
          // "Bullet"). Silently rewrite to the existing spelling.
          setAgent(resolution.canonical);
          setStep("preview");
          return;
        }
        if (!sameLetters) {
          // Alias / Levenshtein typo — confirmation modal lets the
          // operator either fold into the canonical or split.
          const canonicalRateCount = existingRates.filter(
            (r) =>
              r.agent.trim().toLowerCase() ===
              resolution.canonical.toLowerCase()
          ).length;
          setAgentSuggestion({ typed, resolution, canonicalRateCount });
          return;
        }
      }
      // Fall-through: typed agent has neither a catalog hit nor a
      // resolver suggestion. This is a brand-new name — bring up the
      // strict cross-check modal so the operator commits.
      setCrossCheckModal({ typed });
      return;
    }
    setStep("preview");
  };

  // Pending duplicate-confirmation modal state. When the user clicks
  // Guardar and any of the to-save rates would step on an existing rate
  // with overlapping validity (Fix 7), we surface a modal that lets them
  // replace, skip, or cancel before any storage write happens.
  const [duplicateModal, setDuplicateModal] = useState<{
    rates: Rate[];
    overlaps: Array<{ newRate: Rate; existing: Rate }>;
  } | null>(null);

  const saveSelected = () => {
    if (!effectiveValidity) return;
    if (isEditMode && editingRate && onSaveEdit) {
      const row = previewRows[0]!;
      const updated = buildRateFromRow(
        row,
        {
          agent: effectiveAgent,
          validFrom: effectiveValidity.validFrom,
          validTo: effectiveValidity.validTo,
        },
        0,
        batchKinds,
        batchKindValues
      );
      // Preserve the original id when editing.
      onSaveEdit({ ...updated, id: editingRate.id });
      return;
    }
    // Save filters out blocked rows even if the user explicitly checked
    // them — blocking flags (Reefer SF out of band, Thermal Liner
    // suspected as rate) are intentionally hard-stop. The user must
    // edit the rate to clear the flag before it can be saved.
    const selected = previewRows.filter(
      (r, i) => previewSelected.has(i) && !r._blockingError
    );
    const blockedCount = previewRows.filter(
      (r, i) => previewSelected.has(i) && r._blockingError
    ).length;
    if (selected.length === 0) {
      setError(
        blockedCount > 0
          ? `Las ${blockedCount} fila${blockedCount === 1 ? "" : "s"} seleccionada${blockedCount === 1 ? "" : "s"} tiene${blockedCount === 1 ? "" : "n"} errores bloqueantes — editalas o desmarcalas antes de guardar.`
          : "Seleccioná al menos una fila para guardar."
      );
      return;
    }
    if (blockedCount > 0) {
      setError(
        `${blockedCount} fila${blockedCount === 1 ? "" : "s"} con error bloqueante NO se guardará${blockedCount === 1 ? "" : "n"} (editá o desmarcá para revisar).`
      );
    }
    const rates = selected.map((row, idx) =>
      buildRateFromRow(
        row,
        {
          agent: effectiveAgent,
          validFrom: effectiveValidity.validFrom,
          validTo: effectiveValidity.validTo,
        },
        idx,
        batchKinds,
        batchKindValues
      )
    );
    // Fix 7: detect overlaps with existing rates BEFORE writing. Two
    // rates conflict when (agent, carrier, pol, pod, tipo) match case-
    // insensitively AND their [validFrom, validTo] ranges intersect.
    // Empty validFrom / validTo on the existing side is treated as
    // unbounded for that endpoint so we don't accidentally let a
    // legacy rate slip through.
    const overlaps: Array<{ newRate: Rate; existing: Rate }> = [];
    for (const newRate of rates) {
      const match = existingRates.find(
        (er) =>
          er.id !== newRate.id &&
          er.agent.trim().toLowerCase() ===
            newRate.agent.trim().toLowerCase() &&
          er.carrier.trim().toLowerCase() ===
            newRate.carrier.trim().toLowerCase() &&
          (er.pol ?? "").trim().toLowerCase() ===
            (newRate.pol ?? "").trim().toLowerCase() &&
          (er.pod ?? "").trim().toLowerCase() ===
            (newRate.pod ?? "").trim().toLowerCase() &&
          er.tipo === newRate.tipo &&
          (() => {
            const aFrom = (er.validFrom ?? "").trim() || "0000-01-01";
            const aTo = (er.validTo ?? "").trim() || "9999-12-31";
            const bFrom = newRate.validFrom || "0000-01-01";
            const bTo = newRate.validTo || "9999-12-31";
            return aFrom <= bTo && aTo >= bFrom;
          })()
      );
      if (match) overlaps.push({ newRate, existing: match });
    }
    if (overlaps.length > 0) {
      setDuplicateModal({ rates, overlaps });
      return;
    }
    onSaveMany(rates);
  };

  // Resolves the duplicate modal with one of three actions:
  //   "replace"     → save the entire batch; downstream handler removes
  //                   conflicting existing rates by id before insert
  //   "skip"        → save only the rates that don't overlap
  //   "cancel"      → close the modal, no writes
  const resolveDuplicates = (action: "replace" | "skip") => {
    const modal = duplicateModal;
    if (!modal) return;
    setDuplicateModal(null);
    if (action === "replace") {
      // Stamp each conflicting NEW rate with the existing rate's id so
      // the catalog updates in-place (the local store treats matching
      // id as upsert). Non-conflicting rates keep their fresh ids.
      const replaceMap = new Map<string, string>();
      for (const { newRate, existing } of modal.overlaps) {
        replaceMap.set(newRate.id, existing.id);
      }
      const stamped = modal.rates.map((r) => {
        const reuseId = replaceMap.get(r.id);
        return reuseId ? { ...r, id: reuseId } : r;
      });
      onSaveMany(stamped);
    } else {
      const overlapIds = new Set(modal.overlaps.map((o) => o.newRate.id));
      const survivors = modal.rates.filter((r) => !overlapIds.has(r.id));
      if (survivors.length === 0) {
        setError(
          "Todas las tarifas seleccionadas se solapan con tarifas existentes. Nada para guardar."
        );
        return;
      }
      onSaveMany(survivors);
    }
  };

  // ---- Step 2: row update + selection ----
  const togglePreview = (idx: number) =>
    setPreviewSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  // Removes a preview row entirely. Called from PreviewStep's Eliminar
  // button after the user confirms the modal. Selection indices past the
  // removed slot shift left by 1; the editing index closes if it was the
  // removed row, or shifts if past. Only used during preview — the saved
  // rates listing has its own delete UX in RatesTab.
  const deletePreviewRow = (idx: number) => {
    setPreviewRows((prev) => prev.filter((_, i) => i !== idx));
    setPreviewSelected((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < idx) next.add(i);
        else if (i > idx) next.add(i - 1);
        // i === idx → drop
      }
      return next;
    });
    setEditingIdx((cur) => {
      if (cur == null) return cur;
      if (cur === idx) return null;
      if (cur > idx) return cur - 1;
      return cur;
    });
  };
  const toggleAllPreview = () => {
    setPreviewSelected((prev) => {
      const all = previewRows.length > 0 && prev.size === previewRows.length;
      if (all) return new Set();
      return new Set(previewRows.map((_, i) => i));
    });
  };
  const updatePreviewField = (idx: number, field: string, value: unknown) => {
    const yearHint =
      (effectiveValidity?.validTo &&
        parseInt(effectiveValidity.validTo.slice(0, 4), 10)) ||
      (effectiveValidity?.validFrom &&
        parseInt(effectiveValidity.validFrom.slice(0, 4), 10)) ||
      new Date().getFullYear();
    setPreviewRows((prev) => {
      const next = prev.slice();
      const updated: Record<string, unknown> = { ...next[idx], [field]: value };
      // Full live re-evaluation on every keystroke. The recompute helper
      // walks the blocking priority chain (reefer_range → phantom_kind →
      // country_not_port → carrier_missing → pod_missing) AND refreshes
      // _needsReview via isRateNeedsReview, so editing any field
      // (carrier / pol / pod / sf / blFee / tipo / incoterm) leaves the
      // row's flags consistent with its current values without needing
      // a re-process.
      next[idx] = recomputeRowFlags(
        updated,
        effectiveValidity,
        batchKinds,
        batchKindValues,
        yearHint
      );
      return next;
    });
  };

  // Closes the inline edit. When the user typed multi-carrier ("OOCL/
  // Hapag") in the Carrier field, the row at idx is replaced by N rows,
  // one per carrier, otherwise just the trimmed single carrier survives.
  // All resulting rows are run through recomputeRowFlags so any
  // carrier-related blocking (carrier_missing, phantom_kind) clears
  // immediately. Selection of the original row propagates to all
  // clones — saveSelected then filters by _blockingError so newly-
  // unblocked clones go to the save list.
  const commitAndCloseEdit = (idx: number) => {
    const yearHint =
      (effectiveValidity?.validTo &&
        parseInt(effectiveValidity.validTo.slice(0, 4), 10)) ||
      (effectiveValidity?.validFrom &&
        parseInt(effectiveValidity.validFrom.slice(0, 4), 10)) ||
      new Date().getFullYear();
    const original = previewRows[idx];
    if (!original) {
      setEditingIdx(null);
      return;
    }
    const carrierRaw = String(original.carrier ?? "").trim();
    const carriers = carrierRaw
      .split("/")
      .map((c) => c.trim())
      .filter(Boolean);

    if (carriers.length <= 1) {
      // Single (or empty) carrier — recompute in-place and close. Empty
      // carrier still goes through recompute so the carrier_missing
      // block stays active until the user fills the field. The POD
      // value also gets canonicalised here so a typed casing variant
      // ("hong kong" / "HONG KONG") folds into the existing catalog
      // entry (Fix 9).
      setPreviewRows((prev) => {
        const next = prev.slice();
        const single = carriers[0] ?? "";
        const rawPod = String(next[idx]?.pod ?? "");
        const canonicalPod = rawPod
          ? resolvePodCanonical(rawPod, knownPods)
          : "";
        const updated = {
          ...next[idx],
          carrier: single,
          sl: String(next[idx]?.sl ?? "").trim() || single,
          pod: canonicalPod,
        };
        next[idx] = recomputeRowFlags(
          updated,
          effectiveValidity,
          batchKinds,
          batchKindValues,
          yearHint
        );
        return next;
      });
      setEditingIdx(null);
      return;
    }

    // Multi-carrier: split into N rows. Selection of the original
    // row maps to all clones (they share the same identifying fields
    // beyond carrier). Indices of all rows past idx shift by (N-1).
    // Each clone past the first gets a fresh _id so kinds carrying
    // affected_rate_ids can be re-targeted by the user (the original
    // _id stays on the first clone — that one inherits any existing
    // affected_rate_ids ownership).
    setPreviewRows((prev) => {
      const next: Record<string, unknown>[] = [];
      for (let i = 0; i < prev.length; i++) {
        if (i !== idx) {
          next.push(prev[i]!);
          continue;
        }
        for (let k = 0; k < carriers.length; k++) {
          const c = carriers[k]!;
          const cloneId =
            k === 0
              ? prev[i]!._id
              : `preview-${Date.now()}-${i}-${k}-${Math.random()
                  .toString(36)
                  .slice(2, 8)}`;
          const cloned = recomputeRowFlags(
            {
              ...prev[i]!,
              _id: cloneId,
              carrier: c,
              sl: c,
            },
            effectiveValidity,
            batchKinds,
            batchKindValues,
            yearHint
          );
          next.push(cloned);
        }
      }
      return next;
    });
    const oldLength = previewRows.length;
    setPreviewSelected((prev) => {
      const wasChecked = prev.has(idx);
      const out = new Set<number>();
      for (let i = 0; i < oldLength; i++) {
        if (i < idx) {
          if (prev.has(i)) out.add(i);
        } else if (i > idx) {
          if (prev.has(i)) out.add(i + (carriers.length - 1));
        }
      }
      if (wasChecked) {
        for (let k = 0; k < carriers.length; k++) out.add(idx + k);
      }
      return out;
    });
    setEditingIdx(null);
  };

  // ---- Validity stats ----
  // needs-review = the row failed the extraction-validity check captured at
  // conversion time (missing pol/pod, unknown container type, or non-numeric
  // sf/blFee). SF=0 and SF<0 are NOT triggers — those are legitimate values.
  const stats = useMemo(() => {
    const total = previewRows.length;
    const needsReview = previewRows.filter((r) => r._needsReview === true).length;
    return { total, ok: total - needsReview, needsReview };
  }, [previewRows]);

  // Live re-evaluation of preview-row flags whenever the batch validity
  // changes. The user might have clicked Procesar before picking Q2, then
  // selected the quarter afterwards — without this effect the rows stay
  // stuck at their original flags ("Validez del batch vencida" yellow on
  // every row) until they re-process, which costs an LLM call. The
  // recompute only updates flag fields, never touches the extracted
  // values or notas, so it's safe to run on every validity tweak.
  useEffect(() => {
    if (!extractionDone) return;
    if (previewRows.length === 0) return;
    const batchYearHint =
      (effectiveValidity?.validTo &&
        parseInt(effectiveValidity.validTo.slice(0, 4), 10)) ||
      (effectiveValidity?.validFrom &&
        parseInt(effectiveValidity.validFrom.slice(0, 4), 10)) ||
      new Date().getFullYear();
    setPreviewRows((prev) =>
      prev.map((row) =>
        recomputeRowFlags(
          row,
          effectiveValidity,
          batchKinds,
          batchKindValues,
          batchYearHint
        )
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveValidity?.validFrom, effectiveValidity?.validTo]);

  // ESC does NOT close the Nueva Tarifa flow. Hitting ESC by accident
  // during a long extraction (Step 1 with text pegado, or Step 2 with
  // preview) used to wipe everything — generated noise + frustration in
  // the smoke test. The user closes the flow explicitly via "Cancelar"
  // (Step 1) or "Volver" (Step 2). Modals (validation, edit-row,
  // delete-confirm, AddKind, notes) handle their own close UX via the ✕
  // button or backdrop click — they never installed an ESC listener of
  // their own, so removing this global one doesn't regress modal close.

  // ============== Render ==============

  if (chunkProgress) {
    const pct = Math.round(
      (chunkProgress.current / chunkProgress.total) * 100
    );
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h3 className="font-semibold mb-2">
          Procesando bloque {chunkProgress.current} de {chunkProgress.total}
          {chunkProgress.retrying ? " (reintentando)" : ""}...
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          El Excel se está enviando a Claude en bloques de {CHUNK_DATA_ROWS} filas. No cierres esta pestaña.
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 h-2 transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  if (step === "input") {
    return (
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Nueva tarifa</h3>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        </div>

        {/* === Zone A: Header === */}
        <Step1AgentField
          agent={agent}
          onChange={setAgent}
          suggestions={agentSuggestions}
          match={agentMatch}
        />
        <PendingAgentsBadge
          entities={entities}
          rates={existingRates}
          validity={resolvedValidity}
          label={
            validityMode === "quarter" && quarterPicked.size > 0
              ? `${Array.from(quarterPicked).join("/")} ${quarterYear}`
              : resolvedValidity
                ? `${formatDateCl(resolvedValidity.validFrom)} – ${formatDateCl(
                    resolvedValidity.validTo
                  )}`
                : ""
          }
          onPickAgent={(name) => setAgent(name)}
        />

        {/* Inferred-agent banner. Shown only when extraction inferred a name
            AND the user has nothing typed — never overrides a non-empty input. */}
        {!agent.trim() && agentInferred && (
          <div className="text-xs bg-blue-50 text-blue-900 border border-blue-200 rounded px-2 py-1.5 flex items-center gap-2">
            <span>
              Agente detectado: <strong>{agentInferred}</strong>
            </span>
            <button
              type="button"
              onClick={() => setAgent(agentInferred)}
              className="px-2 py-0.5 rounded border border-blue-300 bg-white hover:bg-blue-100 cursor-pointer"
            >
              Usar
            </button>
            <button
              type="button"
              onClick={() => setAgentInferred("")}
              className="text-blue-700 underline cursor-pointer"
            >
              Ignorar
            </button>
          </div>
        )}

        <Step1ValidityField
          mode={validityMode}
          onChangeMode={setValidityMode}
          validFrom={validFrom}
          validTo={validTo}
          onChangeFrom={setValidFrom}
          onChangeTo={setValidTo}
          year={quarterYear}
          onChangeYear={setQuarterYear}
          picked={quarterPicked}
          onTogglePicked={(q) => {
            setQuarterPicked((prev) => {
              const next = new Set(prev);
              if (next.has(q)) next.delete(q);
              else next.add(q);
              return next;
            });
          }}
          resolved={resolvedValidity}
        />

        {/* Inferred-validity banner. Same precedence rule. */}
        {!validFrom && !validTo && validityInferred?.from && (
          <div className="text-xs bg-blue-50 text-blue-900 border border-blue-200 rounded px-2 py-1.5 flex items-center gap-2">
            <span>
              Validez detectada:{" "}
              <strong>
                {validityInferred.from}
                {validityInferred.to ? ` — ${validityInferred.to}` : ""}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => {
                if (validityInferred.from) setValidFrom(validityInferred.from);
                if (validityInferred.to) setValidTo(validityInferred.to);
                setValidityInferred(null);
              }}
              className="px-2 py-0.5 rounded border border-blue-300 bg-white hover:bg-blue-100 cursor-pointer"
            >
              Usar
            </button>
            <button
              type="button"
              onClick={() => setValidityInferred(null)}
              className="text-blue-700 underline cursor-pointer"
            >
              Ignorar
            </button>
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Notas del batch (opcional)</span>
          {showAutoInsertBanner && (
            <span className="text-xs bg-blue-50 text-blue-900 border border-blue-200 rounded px-2 py-1.5 flex items-center gap-2">
              <span className="flex-1">
                ℹ️ Detectamos información adicional y la agregamos a las notas
                del batch. Podés editar o eliminar.
              </span>
              <button
                type="button"
                onClick={() => setShowAutoInsertBanner(false)}
                className="text-blue-700 hover:bg-blue-100 rounded px-1.5 cursor-pointer"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </span>
          )}
          <textarea
            value={batchNotas}
            onChange={(e) => setBatchNotas(e.target.value)}
            placeholder="Free days, contexto de mercado, add-ons regionales — info que aplica a todas las tarifas del batch"
            rows={4}
            className="w-full border border-gray-200 rounded-md p-2 text-sm"
          />
        </label>

        {/* === Zone B: Kinds editor === */}
        <Step1KindsEditor
          kinds={batchKinds}
          values={batchKindValues}
          totalRows={previewRows.length}
          onAdd={addKind}
          onRemove={removeKind}
          onUpdateDef={updateKindDef}
          onUpdateValue={updateKindValue}
        />

        {/* === Zone C: Input === */}
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">
            Datos de las tarifas (subí archivo o pegá texto)
          </div>
          <div
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInput.current?.click();
              }
            }}
            className={`cursor-pointer border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-blue-500 hover:bg-blue-50"
            }`}
          >
            {fileName ? (
              <div className="text-sm">
                <div className="font-medium text-gray-800">{fileName}</div>
                <div className="text-gray-500 mt-1">
                  Listo — clic o soltá otro para reemplazar
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                <div className="text-2xl mb-2">📄</div>
                <div className="font-medium">
                  Arrastrá o hacé clic para subir un archivo
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Excel (.xlsx), PDF, Word (.docx), imagen, screenshot de email
                </div>
              </div>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="hidden"
          />
          <textarea
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              if (extractionDone) setExtractionDone(false);
            }}
            placeholder="O pegá aquí el texto con las tarifas (ej: cuerpo del email del agente)"
            rows={6}
            className="w-full border border-gray-200 rounded-md p-2 text-sm font-mono"
          />
        </div>

        {excelTruncWarning && (
          <div className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">
            ⚠️ {excelTruncWarning}
          </div>
        )}
        {extractionInfo && !error && (
          <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
            ✓ {extractionInfo}
          </div>
        )}
        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-2 flex-wrap">
          <Button
            variant={extractionDone ? "outline" : "default"}
            onClick={handleProcessClick}
            disabled={!hasInput || loading}
          >
            {loading
              ? "Procesando..."
              : extractionDone
                ? "Re-procesar"
                : "Procesar archivo"}
          </Button>
          {extractionDone && (
            <Button
              onClick={continueToPreview}
              disabled={continueErrors.length > 0}
              title={continueErrors.join(" · ")}
            >
              Continuar al preview ({previewRows.length} tarifa
              {previewRows.length === 1 ? "" : "s"}) →
            </Button>
          )}
        </div>

        {extractionDone && continueErrors.length > 0 && (
          <ul className="text-xs text-red-600 list-disc pl-5">
            {continueErrors.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}

        {agentSuggestion && (() => {
          const { typed, resolution, canonicalRateCount } = agentSuggestion;
          const reason =
            resolution.source === "alias"
              ? `"${typed}" suele ser una abreviatura de "${resolution.canonical}"`
              : resolution.source === "exact"
                ? `"${typed}" coincide con "${resolution.canonical}" (sólo difiere en mayúsculas)`
                : `"${typed}" se parece a "${resolution.canonical}"${
                    resolution.distance !== undefined
                      ? ` (distancia ${resolution.distance})`
                      : ""
                  }`;
          const useCanonical = () => {
            setAgent(resolution.canonical);
            setAgentSuggestion(null);
            setStep("preview");
          };
          const keepTyped = () => {
            setAgentSuggestion(null);
            setStep("preview");
          };
          const cancel = () => {
            setAgentSuggestion(null);
          };
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              onClick={cancel}
            >
              <div
                className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-5 flex flex-col gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                <h4 className="font-semibold text-base flex items-center gap-2 flex-wrap">
                  <span>¿Quisiste decir {resolution.canonical}?</span>
                  {(() => {
                    const c = comercialByAgent.get(
                      resolution.canonical.toLowerCase()
                    );
                    return c ? <ComercialBadge comercial={c} /> : null;
                  })()}
                </h4>
                <p className="text-sm text-gray-700">
                  {reason}. Ya hay <strong>{canonicalRateCount}</strong>{" "}
                  tarifa{canonicalRateCount === 1 ? "" : "s"} guardada
                  {canonicalRateCount === 1 ? "" : "s"} con ese agente — si
                  son los mismos, conviene consolidar.
                </p>
                <div className="flex justify-end gap-2 flex-wrap">
                  <Button variant="outline" onClick={cancel}>
                    Cancelar
                  </Button>
                  <Button variant="outline" onClick={keepTyped}>
                    No, crear &quot;{typed}&quot;
                  </Button>
                  <Button onClick={useCanonical}>
                    Sí, usar {resolution.canonical}
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

        {crossCheckModal && (
          <CrossCheckModal
            typed={crossCheckModal.typed}
            activeAgents={activeAgentEntities}
            onClose={() => setCrossCheckModal(null)}
            onPickExisting={(canonical) => {
              setAgent(canonical);
              setCrossCheckModal(null);
              setStep("preview");
            }}
            onCreate={(name, comercial, email, phone) => {
              const trimmed = name.trim();
              if (!trimmed) return;
              const now = new Date().toISOString();
              const slug = trimmed
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
              const newEntity: Entity = {
                id: `entity-${Date.now()}-${slug || "new"}-${Math.random()
                  .toString(36)
                  .slice(2, 6)}`,
                name: trimmed,
                type: "Agente",
                comercial,
                status: "active",
                contact_email: email.trim() || undefined,
                contact_phone: phone.trim() || undefined,
                created_at: now,
                updated_at: now,
              };
              addEntity(newEntity);
              if (trimmed !== effectiveAgent.trim()) setAgent(trimmed);
              setCrossCheckModal(null);
              setStep("preview");
            }}
          />
        )}

        {validationModal && (() => {
          const fieldsLabel =
            validationModal.fields.length === 1
              ? validationModal.fields[0]!
              : validationModal.fields.join(" y ");
          const close = () => {
            const target = validationModal.focusTarget;
            setValidationModal(null);
            // Focus the offending input after the modal unmounts so the
            // browser doesn't fight the modal's autofocus.
            requestAnimationFrame(() => {
              if (target === "agent") {
                document.getElementById("batch-agent-input")?.focus();
              } else {
                document
                  .getElementById("batch-validity-q-first")
                  ?.focus();
              }
            });
          };
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              onClick={close}
            >
              <div
                className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-5 flex flex-col gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                <h4 className="font-semibold text-base">
                  Falta completar {fieldsLabel}
                </h4>
                <p className="text-sm text-gray-700">
                  Antes de procesar, completá <strong>{fieldsLabel}</strong>{" "}
                  del batch. Las tarifas extraídas heredan estos datos
                  automáticamente.
                </p>
                <div className="flex justify-end">
                  <Button onClick={close}>Entendido</Button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // step === "preview"
  return (
    <>
      <PreviewStep
        isEditMode={isEditMode}
        agent={effectiveAgent}
        validity={effectiveValidity}
        kinds={batchKinds}
        kindValues={batchKindValues}
        batchNotas={batchNotas}
        rows={previewRows}
        selected={previewSelected}
        editingIdx={editingIdx}
        stats={stats}
        podSuggestions={podSuggestions}
        onToggle={togglePreview}
        onToggleAll={toggleAllPreview}
        onSetEditingIdx={setEditingIdx}
        onUpdateField={updatePreviewField}
        onCommitEdit={commitAndCloseEdit}
        onDelete={deletePreviewRow}
        onBack={isEditMode ? onCancel : () => setStep("input")}
        onSave={saveSelected}
        onCancel={onCancel}
        error={error}
      />
      {duplicateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDuplicateModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 p-5 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-semibold text-base">
              {duplicateModal.overlaps.length} de{" "}
              {duplicateModal.rates.length} tarifa
              {duplicateModal.rates.length === 1 ? "" : "s"} se solapa
              {duplicateModal.overlaps.length === 1 ? "" : "n"} con tarifas
              existentes
            </h4>
            <p className="text-sm text-gray-700">
              Detectamos coincidencias por (agente, carrier, POL, POD,
              tipo) cuya validez se superpone con el rango del batch.
              Decidí qué hacer antes de guardar.
            </p>
            <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto text-xs">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {[
                      "Carrier",
                      "Ruta",
                      "Tipo",
                      "SF nuevo / existente",
                      "Vigencia existente",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-2 py-1.5 text-left font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {duplicateModal.overlaps.map(({ newRate, existing }) => (
                    <tr key={newRate.id} className="text-xs">
                      <td className="px-2 py-1 whitespace-nowrap">
                        {existing.carrier}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {formatRoute(
                          existing.pol ?? "",
                          existing.pod ?? "",
                          existing.route
                        )}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {existing.tipo}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        ${newRate.sf} / ${existing.sf}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap text-gray-500">
                        {formatDateCl(existing.validFrom)} —{" "}
                        {formatDateCl(existing.validTo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => setDuplicateModal(null)}
              >
                Cancelar
              </Button>
              <Button variant="outline" onClick={() => resolveDuplicates("skip")}>
                Solo nuevas ({duplicateModal.rates.length -
                  duplicateModal.overlaps.length})
              </Button>
              <Button onClick={() => resolveDuplicates("replace")}>
                Reemplazar todas ({duplicateModal.rates.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// Step 1 sub-components
// ============================================================================

// Strict cross-check modal (Bundle 4): the operator typed an agent name
// that has no match in the entity catalog and no resolver suggestion.
// Two paths: pick an existing entity (alias-aware autocomplete), or
// create a new one inline with the commercial assignment so it lands in
// the catalog before the rate flow proceeds. Cancelling rolls back to
// the input step without committing anything.
function CrossCheckModal({
  typed,
  activeAgents,
  onClose,
  onPickExisting,
  onCreate,
}: {
  typed: string;
  activeAgents: Entity[];
  onClose: () => void;
  onPickExisting: (canonical: string) => void;
  onCreate: (
    name: string,
    comercial: ComercialName,
    email: string,
    phone: string
  ) => void;
}) {
  const [mode, setMode] = useState<"pick" | "create">("create");
  const [pickValue, setPickValue] = useState("");
  const [pickFilter, setPickFilter] = useState("");
  const [comercial, setComercial] = useState<ComercialName>("No determinado");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const filtered = useMemo(() => {
    const q = pickFilter.toLowerCase().trim();
    return activeAgents
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeAgents, pickFilter]);
  const submit = () => {
    if (mode === "pick") {
      const target = activeAgents.find((e) => e.id === pickValue);
      if (!target) return;
      onPickExisting(target.name);
    } else {
      onCreate(typed, comercial, email, phone);
    }
  };
  const canSubmit =
    mode === "pick" ? !!pickValue : !!comercial;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 p-5 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="font-semibold text-base">
          Agente &quot;{typed}&quot; no está en el catálogo
        </h4>
        <p className="text-sm text-gray-700">
          Antes de continuar, indicá si es un agente existente del catálogo
          o querés crear uno nuevo. El catálogo se mantiene en{" "}
          <strong>Agentes &amp; Clientes</strong>.
        </p>
        <div className="flex flex-col gap-2 border border-gray-200 rounded-md p-3">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              checked={mode === "pick"}
              onChange={() => setMode("pick")}
              className="mt-1"
            />
            <span className="flex-1 flex flex-col gap-1">
              <span className="font-medium">Es un agente existente</span>
              {mode === "pick" && (
                <>
                  <input
                    type="text"
                    placeholder="Filtrar..."
                    value={pickFilter}
                    onChange={(e) => setPickFilter(e.target.value)}
                    className="border border-gray-200 rounded p-1.5 h-8 text-xs"
                  />
                  <select
                    size={Math.min(6, Math.max(3, filtered.length))}
                    value={pickValue}
                    onChange={(e) => setPickValue(e.target.value)}
                    className="border border-gray-200 rounded p-1 text-xs bg-white"
                  >
                    {filtered.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} · {e.comercial}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              checked={mode === "create"}
              onChange={() => setMode("create")}
              className="mt-1"
            />
            <span className="flex-1 flex flex-col gap-2">
              <span className="font-medium">
                Crear agente nuevo &quot;{typed}&quot;
              </span>
              {mode === "create" && (
                <div className="flex flex-col gap-2 text-xs">
                  <label className="flex flex-col gap-1">
                    <span className="text-gray-600 font-medium">
                      Comercial *
                    </span>
                    <select
                      value={comercial}
                      onChange={(e) =>
                        setComercial(e.target.value as ComercialName)
                      }
                      style={{
                        backgroundColor: COMERCIAL_COLORS[comercial].bg,
                        color: COMERCIAL_COLORS[comercial].text,
                      }}
                      className="px-2 py-1.5 rounded border-0 font-medium"
                    >
                      {COMERCIALES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-gray-600 font-medium">Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="border border-gray-200 rounded p-1.5 h-8"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-gray-600 font-medium">Phone</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="border border-gray-200 rounded p-1.5 h-8"
                    />
                  </label>
                </div>
              )}
            </span>
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            Confirmar y proceder
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step1AgentField({
  agent,
  onChange,
  suggestions,
  match,
}: {
  agent: string;
  onChange: (v: string) => void;
  suggestions: string[];
  match: { exactMatch: string | null; similar: string[] };
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Agente</span>
      <input
        id="batch-agent-input"
        type="text"
        list="new-rate-agent-sugg"
        value={agent}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ej: Balguerie, IWS, Van Moer"
        className="border border-gray-200 rounded-md p-2 h-10"
        // Suppress the browser's history-based autocomplete so the
        // PendingAgentsBadge dropdown is the only source of suggestions.
        autoComplete="off"
      />
      <datalist id="new-rate-agent-sugg">
        {suggestions.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>
      {agent.trim() && match.exactMatch && (
        <span className="text-xs bg-green-50 text-green-800 border border-green-200 rounded px-2 py-1">
          ✓ Este agente ya existe — se agregarán las nuevas tarifas a{" "}
          <strong>{match.exactMatch}</strong>
        </span>
      )}
      {agent.trim() && !match.exactMatch && match.similar.length > 0 && (
        <div className="text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 rounded px-2 py-1 flex flex-wrap items-center gap-2">
          <span>¿Te referís a</span>
          {match.similar.slice(0, 3).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              className="px-2 py-0.5 rounded border border-yellow-300 bg-white hover:bg-yellow-100 cursor-pointer"
            >
              {name}
            </button>
          ))}
          <span className="text-yellow-700">
            ? — o seguí escribiendo para crear uno nuevo.
          </span>
        </div>
      )}
    </label>
  );
}

// Surfaces the list of agents whose rates DON'T overlap the chosen
// validity range, so the operator can quickly load whatever's stale.
// Works in BOTH validity modes (quarter picker AND explicit date range)
// because it consumes the resolved {validFrom, validTo} pair, not the
// quarter set. Hidden when no validity is set or nothing is pending.
// Click on the badge expands a sorted dropdown (oldest validTo first);
// click on an entry autocompletes the agent input. Alias-canonicalisation
// collapses "WR" + "WENRAN" so the list doesn't double-count.
function PendingAgentsBadge({
  entities,
  rates,
  validity,
  label,
  onPickAgent,
}: {
  entities: Entity[];
  rates: Rate[];
  validity: { validFrom: string; validTo: string } | null;
  label: string;
  onPickAgent: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // Bundle 4: pending pulled from the curated entity catalog (not from
  // historic rate.agent strings) so empty / brand-new agents like Lyseo
  // and UVK surface even before the first rate exists. Each entry comes
  // back with its assigned commercial so we can render the colour chip.
  const pending = useMemo<PendingAgentEntity[]>(
    () =>
      validity
        ? computePendingAgentsFromCatalog(entities, rates, validity)
        : [],
    [entities, rates, validity]
  );
  useEffect(() => {
    if (typeof console === "undefined") return;
    if (!validity) {
      console.log(
        "[pending-agents] no validity set yet — badge hidden until user picks a quarter or date range"
      );
      return;
    }
    console.log("[pending-agents]", {
      label,
      validityRange: validity,
      totalEntities: entities.length,
      activeAgents: entities.filter(
        (e) => e.type === "Agente" && e.status === "active"
      ).length,
      totalRates: rates.length,
      pendingCount: pending.length,
      sample: pending.slice(0, 5).map((p) => `${p.agent} · ${p.comercial}`),
    });
  }, [validity, label, entities, rates.length, pending]);
  useEffect(() => {
    if (pending.length === 0) setExpanded(false);
  }, [pending.length]);
  if (!validity) return null;
  if (pending.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="self-start text-xs px-2 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 cursor-pointer flex items-center gap-1"
        title={
          expanded
            ? "Colapsar lista"
            : "Click para ver qué agentes te faltan cargar"
        }
      >
        <span aria-hidden="true">📋</span>
        <span>
          {pending.length} agente{pending.length === 1 ? "" : "s"} pendiente
          {pending.length === 1 ? "" : "s"} para {label}
        </span>
        <span className="text-gray-400 ml-1">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className="border border-gray-200 rounded-md bg-white shadow-sm flex flex-col">
          <div className="text-xs text-gray-500 px-3 py-1.5 border-b border-gray-200 bg-gray-50">
            Pendientes {label} ({pending.length}) · ordenados por antigüedad
          </div>
          <ul className="flex flex-col divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {pending.map((p) => {
              const stale = isStaleVsRange(p.lastValidTo, validity.validFrom);
              return (
                <li key={p.agent}>
                  <button
                    type="button"
                    onClick={() => {
                      onPickAgent(p.agent);
                      setExpanded(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-xs flex items-center gap-2"
                  >
                    <span className="text-gray-500">▸</span>
                    <span className="font-medium text-gray-800">
                      {p.agent}
                    </span>
                    <ComercialBadge comercial={p.comercial} />
                    <span className="flex-1" />
                    <span className="text-gray-500">
                      {p.lastValidTo
                        ? `último ${p.lastQuarterLabel}`
                        : "sin tarifas previas"}
                    </span>
                    {stale && (
                      <span className="text-amber-700" title={stale}>
                        ⚠️ {stale}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// Returns a short staleness label ("vencido hace 2Q") when the agent's
// last validTo predates the chosen range start by at least one quarter.
// Empty string otherwise. Used inline by PendingAgentsBadge to highlight
// long-overdue entries.
function isStaleVsRange(
  lastValidTo: string | null,
  rangeFrom: string
): string {
  if (!lastValidTo) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(lastValidTo);
  if (!m) return "";
  const lastYear = parseInt(m[1]!, 10);
  const lastMonth = parseInt(m[2]!, 10);
  const lastQ =
    lastMonth <= 3 ? 1 : lastMonth <= 6 ? 2 : lastMonth <= 9 ? 3 : 4;
  const rm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rangeFrom);
  if (!rm) return "";
  const rangeYear = parseInt(rm[1]!, 10);
  const rangeMonth = parseInt(rm[2]!, 10);
  const rangeQ =
    rangeMonth <= 3 ? 1 : rangeMonth <= 6 ? 2 : rangeMonth <= 9 ? 3 : 4;
  const rangeIdx = rangeYear * 10 + rangeQ;
  const lastIdx = lastYear * 10 + lastQ;
  const delta = rangeIdx - lastIdx;
  if (delta <= 1) return "";
  return `vencido hace ${delta - 1}Q`;
}

function Step1ValidityField({
  mode,
  onChangeMode,
  validFrom,
  validTo,
  onChangeFrom,
  onChangeTo,
  year,
  onChangeYear,
  picked,
  onTogglePicked,
  resolved,
}: {
  mode: "dates" | "quarter";
  onChangeMode: (m: "dates" | "quarter") => void;
  validFrom: string;
  validTo: string;
  onChangeFrom: (v: string) => void;
  onChangeTo: (v: string) => void;
  year: number;
  onChangeYear: (v: number) => void;
  picked: Set<Quarter>;
  onTogglePicked: (q: Quarter) => void;
  resolved: { validFrom: string; validTo: string } | null;
}) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="font-medium">Validez</div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            checked={mode === "dates"}
            onChange={() => onChangeMode("dates")}
          />
          Por fechas exactas
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            checked={mode === "quarter"}
            onChange={() => onChangeMode("quarter")}
          />
          Por quarter
        </label>
      </div>
      {mode === "dates" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            Vigente desde
            <input
              type="date"
              value={validFrom}
              onChange={(e) => onChangeFrom(e.target.value)}
              className="border border-gray-200 rounded-md p-2 h-10"
            />
          </label>
          <label className="flex flex-col gap-1">
            Vigente hasta
            <input
              type="date"
              value={validTo}
              onChange={(e) => onChangeTo(e.target.value)}
              className="border border-gray-200 rounded-md p-2 h-10"
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <label className="flex flex-col gap-1">
              Año
              <input
                type="number"
                value={year}
                min={2020}
                max={2099}
                onChange={(e) => onChangeYear(Number(e.target.value))}
                className="border border-gray-200 rounded-md p-2 h-10 w-28"
              />
            </label>
            <div className="flex items-end gap-2 flex-wrap" id="batch-validity-q-picker">
              {QUARTER_LABELS.map((q, qIdx) => {
                const checked = picked.has(q);
                return (
                  <label
                    key={q}
                    className={`px-3 py-2 rounded-md border cursor-pointer text-sm ${
                      checked
                        ? "bg-blue-100 border-blue-300 text-blue-800"
                        : "bg-white border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onTogglePicked(q)}
                      className="mr-1"
                      id={qIdx === 0 ? "batch-validity-q-first" : undefined}
                    />
                    {q}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {resolved && (
        <div className="text-xs text-gray-700">
          Vigencia resultante:{" "}
          <strong>
            {formatDateCl(resolved.validFrom)} —{" "}
            {resolved.validTo ? formatDateCl(resolved.validTo) : "sin fin"}
          </strong>
        </div>
      )}
    </div>
  );
}

// Renders the kinds editor in Step 1 zone (b). Each kind is shown as a card
// with its scope and value inputs; the user can edit values, change scope,
// remove a kind, or open the AddKindModal to introduce a new one (predefined
// from the catalog or fully custom).
function Step1KindsEditor({
  kinds,
  values,
  totalRows,
  onAdd,
  onRemove,
  onUpdateDef,
  onUpdateValue,
}: {
  kinds: KindDef[];
  values: KindValue[];
  totalRows: number;
  onAdd: (def: KindDef) => void;
  onRemove: (id: string) => void;
  onUpdateDef: (id: string, patch: Partial<KindDef>) => void;
  onUpdateValue: (id: string, patch: Partial<KindValue>) => void;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const valueByKindId = useMemo(() => {
    const m = new Map<string, KindValue>();
    for (const v of values) m.set(v.kind_id, v);
    return m;
  }, [values]);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          Kinds detectados ({kinds.length})
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddModal(true)}
        >
          + Agregar kind
        </Button>
      </div>
      {kinds.length === 0 && (
        <div className="text-xs text-gray-500 border border-dashed border-gray-200 rounded-md p-3 bg-gray-50">
          Procesá un archivo o pegado para auto-detectar kinds, o agregá uno
          manualmente.
        </div>
      )}
      <div className="flex flex-col gap-2">
        {kinds.map((k) => (
          <KindCard
            key={k.id}
            def={k}
            value={valueByKindId.get(k.id) ?? { kind_id: k.id }}
            totalRows={totalRows}
            onUpdateDef={(patch) => onUpdateDef(k.id, patch)}
            onUpdateValue={(patch) => onUpdateValue(k.id, patch)}
            onRemove={() => onRemove(k.id)}
          />
        ))}
      </div>
      {showAddModal && (
        <AddKindModal
          existingIds={new Set(kinds.map((k) => k.id))}
          onClose={() => setShowAddModal(false)}
          onAdd={(def) => {
            onAdd(def);
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}

const SCOPE_LABELS: Record<KindScope, string> = {
  dry: "Dry",
  reefer: "Reefer",
  all: "Todos",
};

function KindCard({
  def,
  value,
  totalRows,
  onUpdateDef,
  onUpdateValue,
  onRemove,
}: {
  def: KindDef;
  value: KindValue;
  totalRows: number;
  onUpdateDef: (patch: Partial<KindDef>) => void;
  onUpdateValue: (patch: Partial<KindValue>) => void;
  onRemove: () => void;
}) {
  const affectedCount = def.affected_rate_ids?.length ?? 0;
  const isPerRow = def.affected_rate_ids !== undefined;
  return (
    <div className="border border-gray-200 rounded-md p-3 bg-white flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={def.label}
          onChange={(e) => onUpdateDef({ label: e.target.value })}
          className="flex-1 min-w-32 border border-gray-200 rounded p-1.5 h-8 text-sm font-medium"
          disabled={def.predefined}
          title={def.predefined ? "Label fija (kind predefinido)" : ""}
        />
        <select
          value={def.scope}
          onChange={(e) => onUpdateDef({ scope: e.target.value as KindScope })}
          className="border border-gray-200 rounded p-1 h-8 text-xs bg-white"
        >
          {(Object.keys(SCOPE_LABELS) as KindScope[]).map((s) => (
            <option key={s} value={s}>
              {SCOPE_LABELS[s]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={def.by_size}
            onChange={(e) => onUpdateDef({ by_size: e.target.checked })}
          />
          por tamaño
        </label>
        {isPerRow ? (
          <button
            type="button"
            onClick={() => onUpdateDef({ affected_rate_ids: undefined })}
            className="px-2 py-0.5 rounded-full text-xs font-medium border bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100 cursor-pointer"
            title="Aplica a filas específicas detectadas en Comments. Click para extender a todas las rates del batch."
          >
            🔗 {affectedCount} de {totalRows} rates
          </button>
        ) : (
          totalRows > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-50 text-gray-700 border-gray-200"
              title="Aplica a todas las rates del batch."
            >
              Todas las rates ({totalRows})
            </span>
          )
        )}
        <button
          type="button"
          onClick={onRemove}
          className="text-red-600 hover:bg-red-50 rounded px-2 py-1 cursor-pointer text-xs"
          aria-label="Eliminar kind"
          title="Eliminar kind"
        >
          ✕
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs">
        {def.by_size ? (
          <>
            <label className="flex items-center gap-1">
              <span className="text-gray-500">20&apos;</span>
              <input
                type="number"
                value={value.value20 ?? ""}
                onChange={(e) =>
                  onUpdateValue({
                    value20: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                className="w-24 border border-gray-200 rounded p-1 h-8"
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-gray-500">40&apos;</span>
              <input
                type="number"
                value={value.value40 ?? ""}
                onChange={(e) =>
                  onUpdateValue({
                    value40: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                className="w-24 border border-gray-200 rounded p-1 h-8"
              />
            </label>
          </>
        ) : (
          <label className="flex items-center gap-1">
            <span className="text-gray-500">valor único</span>
            <input
              type="number"
              value={value.value_unique ?? ""}
              onChange={(e) =>
                onUpdateValue({
                  value_unique:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              className="w-32 border border-gray-200 rounded p-1 h-8"
            />
          </label>
        )}
        {!def.predefined && (
          <span className="text-gray-400 italic">custom</span>
        )}
      </div>
    </div>
  );
}

// Modal for adding a new kind. Two paths:
//   1. Pick from PREDEFINED_KINDS catalog — sets id/label/scope/by_size from catalog.
//   2. Custom kind — user provides label, scope, by_size; id is slugified.
function AddKindModal({
  existingIds,
  onClose,
  onAdd,
}: {
  existingIds: Set<string>;
  onClose: () => void;
  onAdd: (def: KindDef) => void;
}) {
  const [customLabel, setCustomLabel] = useState("");
  const [customScope, setCustomScope] = useState<KindScope>("all");
  const [customBySize, setCustomBySize] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">Agregar kind</h4>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:bg-gray-100 rounded px-2 py-0.5 cursor-pointer"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-gray-700 uppercase tracking-wide">
            Predefinidos
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PREDEFINED_KINDS.map((p) => {
              const already = existingIds.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={already}
                  onClick={() => onAdd(p)}
                  className={`px-2 py-1 text-xs rounded border ${
                    already
                      ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-white border-gray-300 hover:bg-blue-50 cursor-pointer"
                  }`}
                  title={
                    already
                      ? "Ya está agregado"
                      : `${p.label} · scope=${p.scope}${p.by_size ? " · por tamaño" : ""}`
                  }
                >
                  {already ? "✓ " : "+ "}
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="border-t border-gray-200 pt-3 flex flex-col gap-2 text-sm">
          <span className="text-xs text-gray-700 uppercase tracking-wide">
            Custom
          </span>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 flex-1 min-w-32">
              <span className="text-xs text-gray-500">Label</span>
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Ej: Genset Fee"
                className="border border-gray-200 rounded p-1.5 h-9 bg-white"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Scope</span>
              <select
                value={customScope}
                onChange={(e) => setCustomScope(e.target.value as KindScope)}
                className="border border-gray-200 rounded p-1.5 h-9 bg-white"
              >
                {(Object.keys(SCOPE_LABELS) as KindScope[]).map((s) => (
                  <option key={s} value={s}>
                    {SCOPE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1 text-xs h-9">
              <input
                type="checkbox"
                checked={customBySize}
                onChange={(e) => setCustomBySize(e.target.checked)}
              />
              por tamaño
            </label>
            <Button
              size="sm"
              onClick={() => {
                const lbl = customLabel.trim();
                if (!lbl) return;
                const id = "custom_" + slugifyKindLabel(lbl);
                if (existingIds.has(id)) return;
                onAdd({
                  id,
                  label: lbl,
                  scope: customScope,
                  by_size: customBySize,
                  predefined: false,
                });
              }}
              disabled={!customLabel.trim()}
            >
              Agregar custom
            </Button>
          </div>
          <div className="text-xs text-gray-500">
            Los kinds custom viven solo en este batch — no se persisten en el
            catálogo. Usá un kind predefinido cuando coincida.
          </div>
        </div>
      </div>
    </div>
  );
}

// Aliased to silence "unused" warnings while we keep KIND_ALIASES exposed for
// callers that want to introspect the matcher's vocabulary. Not used directly
// here because matchKindByAlias encapsulates the lookup.
void KIND_ALIASES;

// ============================================================================
// Step 2 — Preview / Edit
// ============================================================================

function PreviewStep({
  isEditMode,
  agent,
  validity,
  kinds,
  kindValues,
  batchNotas,
  rows,
  selected,
  editingIdx,
  stats,
  podSuggestions,
  onToggle,
  onToggleAll,
  onSetEditingIdx,
  onUpdateField,
  onCommitEdit,
  onDelete,
  onBack,
  onSave,
  onCancel,
  error,
}: {
  isEditMode: boolean;
  agent: string;
  validity: { validFrom: string; validTo: string } | null;
  kinds: KindDef[];
  kindValues: KindValue[];
  batchNotas: string;
  rows: Record<string, unknown>[];
  selected: Set<number>;
  editingIdx: number | null;
  stats: { total: number; ok: number; needsReview: number };
  podSuggestions: string[];
  onToggle: (idx: number) => void;
  onToggleAll: () => void;
  onSetEditingIdx: (idx: number | null) => void;
  onUpdateField: (idx: number, field: string, value: unknown) => void;
  onCommitEdit: (idx: number) => void;
  onDelete: (idx: number) => void;
  onBack: () => void;
  onSave: () => void;
  onCancel: () => void;
  error: string | null;
}) {
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const bannerColor =
    stats.ok === stats.total
      ? "bg-green-50 border-green-200 text-green-900"
      : stats.ok === 0
        ? "bg-red-50 border-red-200 text-red-900"
        : "bg-yellow-50 border-yellow-200 text-yellow-900";
  // Count of rows with a hard blocking error. The Guardar button stays
  // disabled while this is > 0 so the user can't accidentally drop blocked
  // rows by saving the rest (Van Moer regression: 3 blocked POD rates were
  // silently discarded when the user clicked save with only 1 corrected).
  const blockedCount = rows.filter(
    (r) => r._blockingError != null && String(r._blockingError).length > 0
  ).length;
  const [filterToReview, setFilterToReview] = useState(false);
  // Eliminar-confirmation modal for the Acciones column. null when closed,
  // otherwise the index of the row pending deletion.
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  // Index of the row whose notes are open in the modal — null when closed.
  // Modal shows the row's individual notes plus the batch-level globales,
  // each in its own section.
  const [notesModalIdx, setNotesModalIdx] = useState<number | null>(null);
  const visibleRows = filterToReview
    ? rows.map((r, i) => ({ r, i })).filter(({ r }) => r._needsReview === true)
    : rows.map((r, i) => ({ r, i }));
  const trimmedBatchNotas = batchNotas.trim();
  const hasBatchNotas = trimmedBatchNotas.length > 0;

  // Index batch kind values by id for quick lookup when rendering each row's
  // kind columns.
  const kindValueById = useMemo(() => {
    const m = new Map<string, KindValue>();
    for (const kv of kindValues) m.set(kv.kind_id, kv);
    return m;
  }, [kindValues]);

  // "Two kinds share the same value" warnings. Empirical analysis showed
  // collisions are rare and usually legitimate (one IWS file had Thermoliner
  // Chile 40' = Thermoliner Mendoza 20' both at 300, distinct contexts that
  // happened to coincide). Surface as informational amber banner — never
  // blocking. User reviews and proceeds.
  const dupValueWarnings = useMemo(
    () => validateKindsValueUniqueness(kinds, kindValues),
    [kinds, kindValues]
  );

  // Headers for the static columns + one column per kind. Kinds with by_size
  // get two sub-columns (20', 40'); single-value kinds get one.
  const kindColumns = useMemo(() => {
    return kinds.flatMap((k) => {
      if (k.by_size) {
        return [
          { kindId: k.id, label: `${k.label} 20'`, size: 20 as const },
          { kindId: k.id, label: `${k.label} 40'`, size: 40 as const },
        ];
      }
      return [{ kindId: k.id, label: k.label, size: null as null | 20 | 40 }];
    });
  }, [kinds]);

  // For one (rate, kindColumn) cell: returns the value to display, or "—"
  // when scope mismatches the rate's tipo (e.g. a dry-only kind on a Reefer
  // rate, or a 20'-only column on a 40' rate). When the kind has an
  // affected_rate_ids list (Fix 1: KATAOKA Disposal extracted from
  // Comments column), only rates whose _id is in the list show the value;
  // every other rate gets "—".
  const renderKindCell = (
    r: Record<string, unknown>,
    col: { kindId: string; size: null | 20 | 40 }
  ): string => {
    const def = kinds.find((k) => k.id === col.kindId);
    if (!def) return "—";
    if (
      def.affected_rate_ids &&
      !def.affected_rate_ids.includes(String(r._id ?? ""))
    ) {
      return "—";
    }
    const tipoStr = String(r.tipo ?? "");
    const isReefer = /reefer/i.test(tipoStr);
    if (def.scope === "dry" && isReefer) return "—";
    if (def.scope === "reefer" && !isReefer) return "—";
    const isForty = /^40/.test(tipoStr);
    if (col.size === 20 && isForty) return "—";
    if (col.size === 40 && !isForty && def.by_size) return "—";
    const kv = kindValueById.get(col.kindId);
    if (!kv) return "—";
    if (def.by_size) {
      const v = col.size === 20 ? kv.value20 : kv.value40;
      return v === undefined ? "—" : `$${v}`;
    }
    return kv.value_unique === undefined ? "—" : `$${kv.value_unique}`;
  };

  const baseHeaders = ["Carrier", "Ruta", "Tipo", "Incoterm", "SF", "BL Fee"];
  const allHeaders = [
    ...baseHeaders,
    ...kindColumns.map((c) => c.label),
    "Notas",
    "Acciones",
  ];
  const colCount = (isEditMode ? 0 : 1) + allHeaders.length;

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">
          {isEditMode ? "Editar tarifa" : "Revisar tarifas extraídas"}
        </h3>
        <div className="flex gap-2">
          {!isEditMode && (
            <Button variant="outline" size="sm" onClick={onBack}>
              Volver
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>

      {/* Common-defaults summary */}
      <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
        <div>
          <strong>Agente:</strong> {agent || "—"}
        </div>
        <div>
          <strong>Vigencia:</strong>{" "}
          {validity
            ? formatBatchVigencia(validity.validFrom, validity.validTo) ||
              `${formatDateCl(validity.validFrom)} — ${
                validity.validTo ? formatDateCl(validity.validTo) : "sin fin"
              }`
            : "—"}
        </div>
        {kinds.length > 0 && (
          <div>
            <strong>Kinds:</strong>{" "}
            {kinds
              .map((k) => {
                const kv = kindValueById.get(k.id);
                if (!kv) return `${k.label}=—`;
                if (k.by_size) {
                  return `${k.label}=${kv.value20 ?? "—"}/${kv.value40 ?? "—"}`;
                }
                return `${k.label}=${kv.value_unique ?? "—"}`;
              })
              .join(" · ")}
          </div>
        )}
      </div>

      {!isEditMode && (
        <>
          <div className={`text-sm rounded-md px-3 py-2 border ${bannerColor}`}>
            📊 Detectamos <strong>{stats.total}</strong> tarifas · Extraídas
            correctamente: <strong>{stats.ok}</strong> · Requieren revisión:{" "}
            <strong>{stats.needsReview}</strong>
            {stats.needsReview > 0 && (
              <button
                type="button"
                onClick={() => setFilterToReview((v) => !v)}
                className="ml-3 text-xs underline cursor-pointer"
              >
                {filterToReview
                  ? "Ver todas"
                  : "Ver solo las que requieren revisión"}
              </button>
            )}
          </div>
          {dupValueWarnings.length > 0 && (
            <div className="text-sm rounded-md px-3 py-2 border bg-yellow-50 border-yellow-200 text-yellow-900 flex flex-col gap-1">
              {dupValueWarnings.map((w, i) => (
                <div key={i}>⚠️ {w}</div>
              ))}
            </div>
          )}
        </>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="overflow-x-auto border border-gray-200 rounded max-h-[60vh] overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {!isEditMode && (
                <th className="px-3 py-2 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    aria-label="Seleccionar todas"
                  />
                </th>
              )}
              {allHeaders.map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {visibleRows.map(({ r, i: idx }) => {
              const isSelected = selected.has(idx);
              const isEditing = editingIdx === idx;
              const carrier = String(r.carrier ?? "");
              const carrierBg = carrier ? carrierColor(carrier) : undefined;
              const needsReview = r._needsReview === true;
              const blockingError =
                typeof r._blockingError === "string" ? r._blockingError : null;
              // Visual treatment: blocking errors get red, regular needs-
              // review (warnings, carrier missing, etc.) get amber so the
              // user can tell apart "must fix" from "should look at".
              const rowBgClass = blockingError
                ? "bg-red-100/70"
                : needsReview
                  ? "bg-amber-50/60"
                  : "";
              return (
                <Fragment key={idx}>
                  <tr
                    className={`text-sm ${
                      isSelected || isEditMode ? "" : "opacity-60"
                    } ${rowBgClass}`}
                    title={blockingError ?? undefined}
                  >
                    {!isEditMode && (
                      <td className="px-3 py-2 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggle(idx)}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {carrier ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: carrierBg }}
                        >
                          {carrier}
                        </span>
                      ) : (
                        <span className="text-red-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {(() => {
                        const display = formatRoute(
                          String(r.pol ?? ""),
                          String(r.pod ?? ""),
                          String(r.route ?? "")
                        );
                        if (display === "—") {
                          return <span className="text-red-600">—</span>;
                        }
                        return display;
                      })()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {String(r.tipo ?? "") || "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {(() => {
                        const inc = String(r.incoterm ?? "").trim();
                        if (!inc) return <span className="text-gray-300">—</span>;
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
                    <td className="px-3 py-2 whitespace-nowrap">
                      ${Number(r.sf ?? 0)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      ${Number(r.blFee ?? 0)}
                    </td>
                    {kindColumns.map((col, ci) => (
                      <td
                        key={ci}
                        className="px-3 py-2 whitespace-nowrap text-xs"
                      >
                        {renderKindCell(r, col)}
                      </td>
                    ))}
                    {(() => {
                      // Compose the Notas display: blocking (🚫 red),
                      // warning (⚠️ amber) or plain notes. The prefix
                      // is built off the row's flag state via
                      // buildWarningPrefix; the user sees WHY the row
                      // is highlighted without opening the modal.
                      const rowNotes = String(r.notes ?? "").trim();
                      const warningInfo = buildWarningPrefix(r, validity);
                      const composedNotes = warningInfo.prefix
                        ? rowNotes
                          ? `${warningInfo.prefix} · ${rowNotes}`
                          : warningInfo.prefix
                        : rowNotes;
                      const hasComposedNotes = composedNotes.length > 0;
                      const truncated = hasComposedNotes
                        ? composedNotes.length > 30
                          ? composedNotes.slice(0, 30) + "…"
                          : composedNotes
                        : "";
                      const showAnything =
                        hasComposedNotes || hasBatchNotas;
                      const severityClass =
                        warningInfo.severity === "blocking"
                          ? "text-red-700 font-medium"
                          : warningInfo.severity === "warning"
                            ? "text-amber-700 font-medium"
                            : "";
                      return (
                        <td
                          className="px-3 py-2 text-xs"
                          style={{ maxWidth: 250, minWidth: 80 }}
                        >
                          {showAnything ? (
                            <button
                              type="button"
                              onClick={() => setNotesModalIdx(idx)}
                              className="text-left flex items-center gap-1 hover:underline cursor-pointer w-full"
                              title={
                                hasComposedNotes
                                  ? composedNotes
                                  : "Aplica nota global del batch"
                              }
                            >
                              {hasComposedNotes ? (
                                <span
                                  className={`truncate flex-1 ${severityClass}`}
                                >
                                  {truncated}
                                </span>
                              ) : (
                                <span className="text-gray-500 italic flex-1">
                                  global
                                </span>
                              )}
                              {hasBatchNotas && (
                                <span
                                  className="text-blue-600 flex-shrink-0"
                                  aria-label="Nota global del batch"
                                >
                                  ℹ️
                                </span>
                              )}
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })()}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {!isEditMode && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              isEditing
                                ? onCommitEdit(idx)
                                : onSetEditingIdx(idx)
                            }
                          >
                            {isEditing ? "Guardar" : "Editar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteIdx(idx)}
                            className="text-red-700 hover:bg-red-50"
                          >
                            Eliminar
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="bg-blue-50/40">
                      <td colSpan={colCount} className="px-3 py-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <RowField
                            label="Carrier *"
                            row={r}
                            field="carrier"
                            onChange={onUpdateField}
                            idx={idx}
                            list="new-rate-carrier-sugg"
                          />
                          <RowField
                            label="POL"
                            row={r}
                            field="pol"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RowField
                            label="POD *"
                            row={r}
                            field="pod"
                            onChange={onUpdateField}
                            idx={idx}
                            list="new-rate-pod-sugg"
                          />
                          <RowField
                            label="Tipo"
                            row={r}
                            field="tipo"
                            onChange={onUpdateField}
                            idx={idx}
                            list="new-rate-tipo-sugg"
                          />
                          <label className="flex flex-col gap-1">
                            Incoterm
                            <select
                              value={String(r.incoterm ?? "FOB/CIF/CFR")}
                              onChange={(e) =>
                                onUpdateField(idx, "incoterm", e.target.value)
                              }
                              className="border border-gray-200 rounded p-1.5 h-8 bg-white"
                            >
                              {INCOTERM_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </label>
                          <RowField
                            label="SL"
                            row={r}
                            field="sl"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RowNumField
                            label="SF"
                            row={r}
                            field="sf"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RowNumField
                            label="BL Fee"
                            row={r}
                            field="blFee"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RowField
                            label="Notas"
                            row={r}
                            field="notes"
                            onChange={onUpdateField}
                            idx={idx}
                            colSpan="col-span-2 md:col-span-4"
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          Los valores de los kinds se editan en Step 1 a nivel
                          de batch (aplican a todas las tarifas).
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {visibleRows.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            {filterToReview
              ? "Ninguna fila requiere revisión."
              : "No se extrajo ninguna tarifa."}
          </div>
        )}
      </div>

      <datalist id="new-rate-carrier-sugg">
        {CARRIER_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="new-rate-tipo-sugg">
        {CONTAINER_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <datalist id="new-rate-pod-sugg">
        {podSuggestions.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <div className="flex justify-end gap-2 mt-2">
        <Button
          onClick={onSave}
          disabled={
            isEditMode
              ? false
              : selected.size === 0 || blockedCount > 0
          }
          title={
            !isEditMode && blockedCount > 0
              ? `Hay ${blockedCount} ${blockedCount === 1 ? "rate con error" : "rates con errores"}. Corregilas o eliminalas para guardar.`
              : undefined
          }
        >
          {isEditMode
            ? "Guardar cambios"
            : `Guardar seleccionadas (${selected.size} de ${rows.length})`}
        </Button>
      </div>

      {deleteIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDeleteIdx(null)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-5 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-semibold text-base">
              Eliminar tarifa del preview
            </h4>
            <p className="text-sm text-gray-700">
              ¿Eliminar esta tarifa? Esta acción no afecta tarifas ya
              guardadas, solo el preview actual.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteIdx(null)}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  const target = deleteIdx;
                  setDeleteIdx(null);
                  if (target != null) onDelete(target);
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}

      {notesModalIdx !== null && (() => {
        const row = rows[notesModalIdx];
        if (!row) return null;
        const rowNotes = String(row.notes ?? "").trim();
        const warningInfo = buildWarningPrefix(row, validity);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setNotesModalIdx(null)}
          >
            <div
              className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 p-4 flex flex-col gap-3 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Notas</h4>
                <button
                  type="button"
                  onClick={() => setNotesModalIdx(null)}
                  className="text-gray-500 hover:bg-gray-100 rounded px-2 py-0.5 cursor-pointer"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>
              {warningInfo.severity === "blocking" && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-red-700">
                    Error bloqueante
                  </span>
                  <pre className="text-sm whitespace-pre-wrap font-sans bg-red-50 border border-red-200 rounded p-2">
                    {warningInfo.prefix}
                  </pre>
                </div>
              )}
              {warningInfo.severity === "warning" && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-amber-700">
                    Warning
                  </span>
                  <pre className="text-sm whitespace-pre-wrap font-sans bg-amber-50 border border-amber-200 rounded p-2">
                    {warningInfo.prefix}
                  </pre>
                </div>
              )}
              {rowNotes ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-gray-500">
                    Nota individual de la rate
                  </span>
                  <pre className="text-sm whitespace-pre-wrap font-sans bg-gray-50 border border-gray-200 rounded p-2">
                    {rowNotes}
                  </pre>
                </div>
              ) : (
                warningInfo.severity === null && (
                  <div className="text-xs text-gray-500 italic">
                    Sin nota individual para esta rate.
                  </div>
                )
              )}
              {hasBatchNotas && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-gray-500">
                    Notas del batch (aplican a todas las rates)
                  </span>
                  <pre className="text-sm whitespace-pre-wrap font-sans bg-blue-50 border border-blue-200 rounded p-2">
                    {trimmedBatchNotas}
                  </pre>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function RowField({
  label,
  row,
  field,
  onChange,
  idx,
  colSpan,
  list,
}: {
  label: string;
  row: Record<string, unknown>;
  field: string;
  onChange: (idx: number, field: string, value: unknown) => void;
  idx: number;
  colSpan?: string;
  list?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${colSpan ?? ""}`}>
      {label}
      <input
        type="text"
        list={list}
        value={String(row[field] ?? "")}
        onChange={(e) => onChange(idx, field, e.target.value)}
        className="border border-gray-200 rounded p-1.5 h-8 bg-white"
      />
    </label>
  );
}

function RowNumField({
  label,
  row,
  field,
  onChange,
  idx,
}: {
  label: string;
  row: Record<string, unknown>;
  field: string;
  onChange: (idx: number, field: string, value: unknown) => void;
  idx: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      {label}
      <input
        type="number"
        value={Number(row[field] ?? 0)}
        onChange={(e) => onChange(idx, field, Number(e.target.value))}
        className="border border-gray-200 rounded p-1.5 h-8 bg-white"
      />
    </label>
  );
}

