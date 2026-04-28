"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/Button";
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
  Quarter,
  Rate,
  carrierColor,
  consolidatePreferentialNotes,
  detectAgencyFee,
  detectAgencyFeeMax,
  detectBundleInclusions,
  detectDisposal,
  detectDiscountInsulated,
  detectEbsNotIncluded,
  detectRegionalAddons,
  detectThermalLinerUnsized,
  extractPreferentialClientsFromLabel,
  findSimilarAgent,
  formatDateCl,
  isDateInPast,
  isLclSheet,
  isParsableNumber,
  isRateNeedsReview,
  matchKindByAlias,
  migrateContainerType,
  parseMultiCarrier,
  quartersToDateRange,
  slugifyKindLabel,
  uniqueSuggestions,
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

HARD RULES:
1. EBS = EFS. NEVER include them in sf or as a kind. "USD 1450 + USD 60 BL Fee + EBS USD 75" → sf=1450, bl_fee=60. Drop EBS silently.
2. Thermal Liner / Thermo Liner / Insulado are the SAME concept — emit the original label, frontend canonicalizes via aliases.
3. Multi-carrier on one row ("OOCL or CMA", "OOCL/EVER", "Carriers: OOCL, EVER"): set sl="OOCL or CMA". DO NOT clone — frontend clones.
4. Bundle "includes X, Y, Z" / "incluye X, Y, Z": keep sf as ONE number (do not split). Add to notas: "Incluye: <list>". Do NOT invent kinds for the inclusions.
5. Per-row validity override: set this row's validFrom/validTo from the row text AND add to notas.
6. Regional add-ons (San Carlos, Tupungato, Rivadavia, San Juan, San Martín, "afuera de Mendoza"): NEVER as a rate row. Append to notas_globales.
7. Free-day info: notas_globales.
8. LCL content: skip entirely. Indicators: "Insulation Chile/Argentina" headers, amounts "per pallet/M3/shipment", early "OF" column, no clear POL+POD+Type triple.
9. Date formats accepted: dd/mm/yyyy, dd/mm (assume current year), "Fin de Junio"/"end of June" (last day of month), "March 31st", "Q2 2026", Excel datetimes. Emit dd/mm/yyyy when possible, else original token.

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

HARD RULES:
1. EBS = EFS. NEVER include them in sf. "USD 1450 + USD 60 BL Fee + EBS USD 75" → sf=1450, bl_fee=60.
2. Thermal Liner / Thermo Liner / Insulado: emit original label.
3. Multi-carrier on one row: set sl="OOCL or CMA". DO NOT clone.
4. Bundle "includes X, Y, Z": keep sf as one number. Add "Incluye: <list>" to notas.
5. LCL rows: skip entirely.
6. Compound SF cells like "USD 2540 + USD 60 BL Fee" or "2540/60": parse first number as sf, second as bl_fee.
7. Any cell whose value reads "USD X per BL" / "USD X xbl" / "USD X / BL" / "USD X per bl" — regardless of column header — IS the rate's bl_fee. Example: a column "(Surcharge 1)" with value "USD 38 per bl" → bl_fee=38, NOT a kind. Multiple per-BL surcharges in the same row → sum them into bl_fee.
8. Columns labeled BAF / Bunker / Surcharge whose cell value is literally "Included" / "Incl." / "Bundled" / "N/A": these mean the surcharge is bundled into SF. DO NOT emit them as kinds and DO NOT use them as numeric values. Append to that rate's notas: "BAF/Bunker incluido en SF.".
9. Regional add-on rows like "Add San Carlos US$ 200 on top of Mendoza" → DO NOT emit them as a rate row. Skip; the frontend handles regional add-ons via a separate sweep.

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

RULES:
- Use value20 + value40 when the source distinguishes sizes; otherwise use value_unique.
- For discounts ("discount of USD 25 if insulated"), emit value_unique as a NEGATIVE number.
- "Thermal Liner = USD X" without size → value_unique: X. Frontend will copy to both 20' and 40'.
- Free-form market context, free days, regional add-ons → notas_globales (NOT as kinds).
- If a charge's value is literally "Included" / "Incl." / "Bundled" / "N/A" (no number), do NOT emit a kind for it — that means it's bundled. Mention in notas_globales if relevant ("BAF incluido en SF.").
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
//   "rate"    — header rows in the first 5 lines contain POL + POD + Type
//               (or close synonyms). The default when in doubt — losing a
//               catalog sheet to the rate path is recoverable (Claude
//               returns no rates from it), losing a rate sheet to the
//               catalog path drops 10s-100s of rates silently.
//   "catalog" — no clear POL+POD+Type triple AND has a Charges/Area/Item
//               header OR a strong majority of rows match a "<Label>
//               <USD num> per container/BL/teu" pattern.
function classifySheet(aoa: unknown[][]): SheetClassification {
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
  if (hasPol && hasPod && hasType) return "rate";

  const hasCatalogHeader = headerArea.some((r) =>
    r.some((c) => /^(charges?|area|item)\b/i.test(String(c ?? "").trim()))
  );
  const dataRows = aoa
    .slice(1)
    .filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
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
  const wb = XLSX.read(buffer, { type: "array" });
  const rateSheets: string[] = [];
  const kindsBlocks: string[] = [];
  const classifications: { name: string; type: SheetClassification }[] = [];
  let totalRows = 0;
  let usedRows = 0;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    // raw: false applies cell formatting at read time. Excel datetime serial
    // numbers (45838) become formatted strings ("30/06/2026") which Claude
    // can parse directly; without it Claude saw raw serials and either
    // treated them as numbers or guessed wrong.
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
      raw: false,
    });
    if (aoa.length === 0) continue;
    const maxCols = Math.max(0, ...aoa.map((r) => r.length));

    const classification = classifySheet(aoa);
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

      const matchedId = matchKindByAlias(label);
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
      if (vu && kv.value_unique === undefined && !def.by_size) {
        kv.value_unique = vu;
      }
      // For by_size kinds where the source provided only a unique value
      // (e.g. CCL "Thermal Liner = USD 350"), copy it to both 20 and 40.
      if (vu && def.by_size) {
        if (kv.value20 === undefined) kv.value20 = vu;
        if (kv.value40 === undefined) kv.value40 = vu;
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

      if (excelText) {
        // LCL + catalog sheets were already filtered out at read time —
        // excelText only contains rate-classified sheet content.
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
      } else if (docxText) {
        const result = await callExtractApi(
          `Contenido del documento Word:\n\n${docxText}`,
          RATE_SYSTEM
        );
        extracted = collectBatchFromChunks(result.rows);
      } else if (pasteText.trim()) {
        const result = await callExtractApi(pasteText, RATE_SYSTEM);
        extracted = collectBatchFromChunks(result.rows);
      }

      // Detect kinds + values from the extracted rate rows.
      const detected = detectKindsFromExtracted(extracted.rates);

      // Second pass: extract kinds from the Excel kinds-block — catalog
      // sheets in full PLUS the right-side blocks of rate sheets. The
      // rate-extraction prompt was intentionally NOT shown this content.
      // Append any new kinds + capture extra notas.
      let extraNotas = "";
      if (excelKindsBlock.trim()) {
        const blockResult = await extractKindsFromBlock(excelKindsBlock);
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
      // + per-rate notas to recover kinds that neither pass picked up. Only
      // adds kinds whose ids aren't already present.
      const sweepText = [
        extracted.notas_globales ?? "",
        extraNotas,
        excelKindsBlock,
        ...extracted.rates.map((r) => toStr(r.notas ?? r.notes)),
      ]
        .filter(Boolean)
        .join("\n");
      const sweepResult = sweepKindsFromText(sweepText, detected.kinds);
      detected.kinds.push(...sweepResult.kinds);
      detected.kindValues.push(...sweepResult.kindValues);

      setBatchKinds(detected.kinds);
      setBatchKindValues(detected.kindValues);

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
      // Regex sweeps for free-text patterns the structured extraction passes
      // commonly miss: regional add-ons ("Add San Carlos US$ 200 on top of
      // Mendoza") and the IWS-style "EBS NOT INCLUDED" repeat-stamp.
      const fullText = [
        excelText,
        excelKindsBlock,
        extracted.notas_globales ?? "",
        extraNotas,
        ...extracted.rates.map((r) => toStr(r.notas ?? r.notes)),
      ]
        .filter(Boolean)
        .join("\n");
      const regionalAddons = detectRegionalAddons(fullText);
      const ebsNotIncludedLine = detectEbsNotIncluded(fullText)
        ? "EBS no incluido en SF (se factura aparte vía Tabla EBS)."
        : "";
      const combinedNotasGlobales = [
        ...preferentialLines,
        ...regionalAddons,
        ebsNotIncludedLine,
        extracted.notas_globales,
        extraNotas,
      ]
        .filter((s) => s && s.trim())
        .join("\n")
        .trim();
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

      // Multi-carrier rows clone into one row per carrier.
      const expanded = expandMultiCarrier(extracted.rates);

      // Convert raw rate rows into preview-table records. The needs-review
      // classification is delegated to constants.ts:isRateNeedsReview — see
      // that function for the criteria. SF=0 and SF<0 are PRESERVED as
      // legitimate values; the asian-POD exception lets differential rates
      // through without flagging.
      const rows: Record<string, unknown>[] = expanded.map((r) => {
        const baseNotes = toStr(r.notas ?? r.notes);
        const tipoOut = coerceContainerType(r.type ?? r.tipo);
        const carrier = toStr(r.carrier);
        const sl = toStr(r.sl) || carrier;
        const pol = toStr(r.pol);
        const pod = toStr(r.pod);
        const route = toStr(r.route) || (pol && pod ? `${pol} - ${pod}` : pol || pod);
        const sfNum = toNumber(r.sf);
        const sfParseable = isParsableNumber(r.sf);
        // Default bl_fee to 0 when the source omitted the field entirely
        // (Excels without a BL Fee column — common for Asian dry routes).
        // "TBD"/"Ask agent" stays as the original string so isParsableNumber
        // returns false and the row gets flagged.
        const rawBlFeeField = r.bl_fee ?? r.blFee;
        const blFeeRaw =
          rawBlFeeField === undefined || rawBlFeeField === null
            ? 0
            : rawBlFeeField;
        const blFeeNum = toNumber(blFeeRaw);
        const rateValidFrom = toStr(r.validFrom);
        const rateValidTo = toStr(r.validTo);

        // Per-row notes assembly. Order matters for readability:
        //   1. Claude's per-rate notas (whatever it emitted)
        //   2. Tipo coercion warning (when source had a non-standard tipo)
        //   3. SF missing warning (when extraction didn't return a number
        //      and the row otherwise has rate-shaped data)
        //   4. Validity-per-rate override (when the row's own validity
        //      differs from the batch effective validity, including
        //      "validez vencida")
        const noteParts: string[] = [];
        if (baseNotes) noteParts.push(baseNotes);
        if (tipoOut.note) noteParts.push(tipoOut.note);
        if (!sfParseable && (pol.trim() || pod.trim() || carrier)) {
          noteParts.push("⚠️ SF faltante en archivo — completar manualmente.");
        }

        // Validity-per-rate override note. Only annotate when the rate has
        // its OWN validFrom/validTo and either differs from effective
        // batch dates OR is already past today. Both cases the user wants
        // to know about explicitly.
        const effFrom = effectiveValidity?.validFrom ?? "";
        const effTo = effectiveValidity?.validTo ?? "";
        const rateHasOwnValidity = !!(rateValidFrom || rateValidTo);
        if (rateHasOwnValidity) {
          const fromDiffers = rateValidFrom && rateValidFrom !== effFrom;
          const toDiffers = rateValidTo && rateValidTo !== effTo;
          if (fromDiffers || toDiffers) {
            const segs: string[] = [];
            if (rateValidFrom) segs.push(formatDateCl(rateValidFrom));
            if (rateValidTo) segs.push(formatDateCl(rateValidTo));
            noteParts.push(`Validez específica: ${segs.join(" — ")}`);
          }
        }
        const expiredEffectiveTo = isDateInPast(rateValidTo || effTo);
        if (expiredEffectiveTo) {
          const expDate = rateValidTo || effTo;
          noteParts.push(`⚠️ Validez vencida: ${formatDateCl(expDate)}`);
        }

        const notes = noteParts.join("\n");
        // Bundle inclusions detection — Claude is instructed to keep SF as
        // a single number and put "Incluye: ..." in notas; this just confirms
        // the marker for visibility (no further processing).
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
            blFeeParseable: isParsableNumber(blFeeRaw),
            validFrom: rateValidFrom,
            validTo: rateValidTo,
          },
          effectiveValidity
        );
        return {
          carrier,
          pol,
          pod,
          route,
          tipo: tipoOut.tipo,
          sl,
          sf: sfNum,
          blFee: blFeeNum,
          validFrom: rateValidFrom,
          validTo: rateValidTo,
          notes: finalNotes,
          _needsReview: needsReview,
        };
      });

      setPreviewRows(rows);
      setPreviewSelected(new Set(rows.map((_, i) => i)));
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
    return {
      id: `rate-${stamp}-${idx}-${rand}`,
      agent: common.agent.trim(),
      carrier: toStr(row.carrier),
      pol: toStr(row.pol),
      pod: toStr(row.pod),
      route: toStr(row.route),
      tipo: tipoOut.tipo,
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

  const continueToPreview = () => {
    if (continueErrors.length > 0) return;
    setStep("preview");
  };

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
    const selected = previewRows.filter((_, i) => previewSelected.has(i));
    if (selected.length === 0) {
      setError("Seleccioná al menos una fila para guardar.");
      return;
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
    onSaveMany(rates);
  };

  // ---- Step 2: row update + selection ----
  const togglePreview = (idx: number) =>
    setPreviewSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  const toggleAllPreview = () => {
    setPreviewSelected((prev) => {
      const all = previewRows.length > 0 && prev.size === previewRows.length;
      if (all) return new Set();
      return new Set(previewRows.map((_, i) => i));
    });
  };
  const updatePreviewField = (idx: number, field: string, value: unknown) => {
    setPreviewRows((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
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

  // Reuse Esc to cancel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

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
            onClick={processInput}
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
      </div>
    );
  }

  // step === "preview"
  return (
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
      onToggle={togglePreview}
      onToggleAll={toggleAllPreview}
      onSetEditingIdx={setEditingIdx}
      onUpdateField={updatePreviewField}
      onBack={isEditMode ? onCancel : () => setStep("input")}
      onSave={saveSelected}
      onCancel={onCancel}
      error={error}
    />
  );
}

// ============================================================================
// Step 1 sub-components
// ============================================================================

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
        type="text"
        list="new-rate-agent-sugg"
        value={agent}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ej: Balguerie, IWS, Van Moer"
        className="border border-gray-200 rounded-md p-2 h-10"
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
            <div className="flex items-end gap-2 flex-wrap">
              {QUARTER_LABELS.map((q) => {
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
  onAdd,
  onRemove,
  onUpdateDef,
  onUpdateValue,
}: {
  kinds: KindDef[];
  values: KindValue[];
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
  onUpdateDef,
  onUpdateValue,
  onRemove,
}: {
  def: KindDef;
  value: KindValue;
  onUpdateDef: (patch: Partial<KindDef>) => void;
  onUpdateValue: (patch: Partial<KindValue>) => void;
  onRemove: () => void;
}) {
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
  onToggle,
  onToggleAll,
  onSetEditingIdx,
  onUpdateField,
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
  onToggle: (idx: number) => void;
  onToggleAll: () => void;
  onSetEditingIdx: (idx: number | null) => void;
  onUpdateField: (idx: number, field: string, value: unknown) => void;
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
  const [filterToReview, setFilterToReview] = useState(false);
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
  // rate, or a 20'-only column on a 40' rate).
  const renderKindCell = (
    r: Record<string, unknown>,
    col: { kindId: string; size: null | 20 | 40 }
  ): string => {
    const def = kinds.find((k) => k.id === col.kindId);
    if (!def) return "—";
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

  const baseHeaders = ["Carrier", "Ruta", "Tipo", "SF", "BL Fee"];
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
            ? `${formatDateCl(validity.validFrom)} — ${
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
              return (
                <Fragment key={idx}>
                  <tr
                    className={`text-sm ${
                      isSelected || isEditMode ? "" : "opacity-60"
                    } ${needsReview ? "bg-red-50/60" : ""}`}
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
                      {String(r.route ?? "") || (
                        <span className="text-red-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {String(r.tipo ?? "") || "—"}
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
                      const rowNotes = String(r.notes ?? "").trim();
                      const hasRowNotes = rowNotes.length > 0;
                      const truncated = hasRowNotes
                        ? rowNotes.length > 30
                          ? rowNotes.slice(0, 30) + "…"
                          : rowNotes
                        : "";
                      const showAnything = hasRowNotes || hasBatchNotas;
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
                                hasRowNotes
                                  ? rowNotes
                                  : "Aplica nota global del batch"
                              }
                            >
                              {hasRowNotes ? (
                                <span className="truncate flex-1">
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onSetEditingIdx(isEditing ? null : idx)
                          }
                        >
                          {isEditing ? "Cerrar" : "Editar"}
                        </Button>
                      )}
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="bg-blue-50/40">
                      <td colSpan={colCount} className="px-3 py-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <RowField
                            label="Carrier"
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
                            label="POD"
                            row={r}
                            field="pod"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RowField
                            label="Ruta"
                            row={r}
                            field="route"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RowField
                            label="Tipo"
                            row={r}
                            field="tipo"
                            onChange={onUpdateField}
                            idx={idx}
                            list="new-rate-tipo-sugg"
                          />
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

      <div className="flex justify-end gap-2 mt-2">
        <Button
          onClick={onSave}
          disabled={isEditMode ? false : selected.size === 0}
        >
          {isEditMode
            ? "Guardar cambios"
            : `Guardar seleccionadas (${selected.size} de ${rows.length})`}
        </Button>
      </div>

      {notesModalIdx !== null && (() => {
        const row = rows[notesModalIdx];
        if (!row) return null;
        const rowNotes = String(row.notes ?? "").trim();
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
                <div className="text-xs text-gray-500 italic">
                  Sin nota individual para esta rate.
                </div>
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

