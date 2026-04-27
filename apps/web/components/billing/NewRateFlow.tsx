"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/Button";
import {
  AGENT_SUGGESTIONS,
  AdditionalCost,
  AdditionalCostKind,
  AppliesTo,
  CARRIER_SUGGESTIONS,
  CONTAINER_TYPE_SUGGESTIONS,
  Quarter,
  Rate,
  buildAdditionalCost,
  carrierColor,
  findSimilarAgent,
  formatDateCl,
  quartersToDateRange,
  uniqueSuggestions,
} from "./constants";

// ============================================================================
// Pure extraction helpers (copied from RateIntake to avoid coupling — both
// flows share these conceptually but the file split is left for a follow-up
// cleanup commit). Any change here that affects extraction quality should
// also be applied to RateIntake.tsx.
// ============================================================================

const STRICT_RESPONSE_RULES_NO_LIMIT = `IMPORTANTE: Respondé SOLO con el JSON, sin backticks de markdown (\`\`\`), sin texto adicional antes o después.`;

const RATE_SYSTEM = `Sos un extractor de tarifas de fletes marítimos. El input puede contener UNA o MÚLTIPLES tarifas (ej: pegado de email, screenshot, o fila individual).

Extrae las tarifas que encuentres. Devolvé un JSON ARRAY con un objeto por cada tarifa.

[
  {
    "carrier": string,       // naviera (OOCL, HAPAG, CMA-CGM, PIL, COSCO, Evergreen, MSC u otra)
    "route": string,         // ruta o puerto de destino
    "tipo": string,          // tipo de contenedor (20', Flexi, 20'-Flexi, 40', 40'HC, 20'RF, 40'RF)
    "sf": number,            // Sea Freight en USD por contenedor
    "blFee": number,         // BL fee en USD por BL
    "notes": string          // observación relevante
  }
]

NO incluyas agente, vigencia ni costos adicionales — esos campos se aplican al guardar desde el formulario común.

${STRICT_RESPONSE_RULES_NO_LIMIT}`;

const RATE_CHUNK_SYSTEM = `Sos un extractor de tarifas de fletes marítimos. El input contiene una tabla con tarifas (una por fila).

Extrae las tarifas. Devolvé un JSON ARRAY con un objeto por cada tarifa/fila. Si el input no es una tabla o no contiene tarifas, devolvé un array vacío.

[
  {
    "carrier": string,       // naviera (OOCL, HAPAG, CMA-CGM, etc.)
    "route": string,         // ruta o puerto de destino
    "tipo": string,          // tipo de contenedor (20', Flexi, 20'-Flexi, 40', 40'HC, 20'RF, 40'RF)
    "sf": number,            // Sea Freight USD por contenedor
    "blFee": number,         // BL fee USD por BL
    "notes": string          // observación relevante
  }
]

Usá "" para strings faltantes y 0 para números faltantes. NO incluyas agente, vigencia, thermalLiner, fcaHaulage ni discountInsulated — esos los aplica el frontend desde el formulario común.

CELDAS COMPUESTAS: si una celda tiene formato "USD 2540 + USD 60 BL Fee" o "USD X + Y BL" (común en tarifas Reefer 40' de PIL u otras navieras), SIEMPRE extralo como UNA tarifa válida — NO descartes esas filas. Parseá el primer número antes del "+" como sf, el segundo como blFee. Lo mismo para variantes tipo "2540/60", "2540 (60 BL)", "2540+60". Si solo hay un número, ponelo en sf y blFee=0.

${STRICT_RESPONSE_RULES_NO_LIMIT}`;

const EXCEL_MAX_ROWS = 150;
const EXCEL_MAX_CHARS = 15000;
const CHUNK_DATA_ROWS = 15;
const MAX_CHUNK_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;
const LARGE_FILE_BYTES = 10 * 1024 * 1024;
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type ExcelReadResult = {
  text: string;
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

async function readExcelAsText(file: File): Promise<ExcelReadResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheets: string[] = [];
  let totalRows = 0;
  let usedRows = 0;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
    });
    if (aoa.length === 0) continue;
    const maxCols = Math.max(0, ...aoa.map((r) => r.length));
    const keepCols: number[] = [];
    for (let c = 0; c < maxCols; c++) {
      if (aoa.some((r) => String(r[c] ?? "").trim() !== "")) keepCols.push(c);
    }
    if (keepCols.length === 0) continue;
    const csvLines = aoa.map((r) =>
      keepCols.map((c) => csvEscapeCell(String(r[c] ?? ""))).join(",")
    );
    const cleaned = cleanCsvText(csvLines.join("\n"));
    if (!cleaned) continue;
    const lines = cleaned.split("\n");
    totalRows += lines.length;
    if (usedRows < EXCEL_MAX_ROWS) {
      const taken = lines.slice(0, EXCEL_MAX_ROWS - usedRows);
      sheets.push(`Hoja: ${name}\n${taken.join("\n")}`);
      usedRows += taken.length;
    }
  }
  let text = sheets.join("\n\n");
  let charTruncated = false;
  if (text.length > EXCEL_MAX_CHARS) {
    text = text.slice(0, EXCEL_MAX_CHARS) + "\n... (truncado)";
    charTruncated = true;
  }
  return {
    text,
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
// Step 1 — UI helpers for the cost editor
// ============================================================================

// Quick-add definitions: predefined cost types the user can add with one
// click. "Otros" is the free-form fallback.
const QUICK_COSTS: Array<{
  kind: AdditionalCostKind;
  label: string;
  applies: AppliesTo;
}> = [
  { kind: "thermal_chile", label: "Thermal Liner Chile 20'", applies: "20" },
  { kind: "thermal_chile", label: "Thermal Liner Chile 40'", applies: "40" },
  { kind: "thermal_mendoza", label: "Thermal Liner Mendoza 20'", applies: "20" },
  { kind: "thermal_mendoza", label: "Thermal Liner Mendoza 40'", applies: "40" },
  { kind: "fca_haulage_mendoza", label: "FCA Haulage Mendoza 20'", applies: "20" },
  { kind: "fca_haulage_mendoza", label: "FCA Haulage Mendoza 40'", applies: "40" },
  { kind: "flexitank_chile", label: "Flexitank Chile 20'", applies: "20" },
  { kind: "flexitank_chile", label: "Flexitank Chile 40'", applies: "40" },
  { kind: "flexitank_argentina", label: "Flexitank Argentina 20'", applies: "20" },
  { kind: "flexitank_argentina", label: "Flexitank Argentina 40'", applies: "40" },
  { kind: "agency_fee", label: "Agency Fee (USD/ctr)", applies: "all" },
  { kind: "agency_fee_max", label: "Agency Fee Max (USD/BL)", applies: "all" },
  { kind: "discount_insulated", label: "Descuento insulado", applies: "dry" },
];

const QUARTER_LABELS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

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

  // ---- Step 1: common defaults ----
  const [agent, setAgent] = useState(editingRate?.agent ?? "");
  const [validityMode, setValidityMode] = useState<"dates" | "quarter">(
    "dates"
  );
  const [validFrom, setValidFrom] = useState(editingRate?.validFrom ?? "");
  const [validTo, setValidTo] = useState(editingRate?.validTo ?? "");
  const [quarterYear, setQuarterYear] = useState<number>(
    new Date().getFullYear()
  );
  const [quarterPicked, setQuarterPicked] = useState<Set<Quarter>>(new Set());
  const [costs, setCosts] = useState<AdditionalCost[]>(
    editingRate?.additionalCosts?.map((c) => ({ ...c })) ?? []
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
            route: editingRate.route,
            tipo: editingRate.tipo,
            sf: editingRate.sf,
            blFee: editingRate.blFee,
            af: editingRate.af,
            afMax: editingRate.afMax,
            flexiArg: editingRate.flexiArg,
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
  const [error, setError] = useState<string | null>(null);

  // Validity resolution (for Step 1 button enable + display).
  const resolvedValidity = useMemo(() => {
    if (validityMode === "dates") {
      if (!validFrom) return null;
      if (validTo && validTo < validFrom) return null;
      return { validFrom, validTo };
    }
    return quartersToDateRange(quarterYear, quarterPicked);
  }, [validityMode, validFrom, validTo, quarterYear, quarterPicked]);

  // Step 1 validity for "Procesar y revisar" button.
  const step1Errors: string[] = [];
  if (!agent.trim()) step1Errors.push("Falta indicar el agente.");
  if (!resolvedValidity)
    step1Errors.push(
      validityMode === "dates"
        ? validFrom && validTo && validTo < validFrom
          ? "La fecha 'Vigente hasta' debe ser ≥ 'Vigente desde'."
          : "Falta la fecha de validez desde."
        : "Falta seleccionar al menos un quarter."
    );
  const hasInput =
    !!fileName || !!pasteText.trim() || !!imageData || !!docxText || !!excelText;
  if (!hasInput && !isEditMode)
    step1Errors.push("Subí un archivo o pegá texto con las tarifas.");

  // ---- File handling ----
  const handleFile = async (file: File) => {
    setError(null);
    setExcelTruncWarning(null);
    setFileName(file.name);
    setImageData(null);
    setDocxText("");
    setExcelText("");
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

  // ---- Step 1 → Step 2 ----
  const processAndReview = async () => {
    if (step1Errors.length > 0) return;
    setLoading(true);
    setError(null);
    try {
      let rows: Record<string, unknown>[] = [];
      if (excelText) {
        const chunks = chunkExcelCsv(excelText);
        const items = chunks.map((c, i) => ({
          index: i + 1,
          content: `Datos del Excel (bloque ${i + 1} de ${chunks.length}):\n\n${c}`,
        }));
        setChunkProgress({ current: 0, total: chunks.length });
        const result = await processChunks(items, chunks.length);
        setChunkProgress(null);
        rows = result.rows;
        if (result.failed.length > 0) {
          setError(
            `Bloques fallidos tras 3 reintentos: ${result.failed.join(", ")}. ${rows.length} tarifas extraídas.`
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
        rows = result.rows;
      } else if (docxText) {
        const result = await callExtractApi(
          `Contenido del documento Word:\n\n${docxText}`,
          RATE_SYSTEM
        );
        rows = result.rows;
      } else if (pasteText.trim()) {
        const result = await callExtractApi(pasteText, RATE_SYSTEM);
        rows = result.rows;
      }
      // Strip any truncated metadata; we don't surface that here.
      const cleaned = rows.map((r) => {
        if ("truncated" in r) {
          const { truncated: _t, ...rest } = r;
          void _t;
          return rest;
        }
        return r;
      });
      setPreviewRows(cleaned);
      setPreviewSelected(new Set(cleaned.map((_, i) => i)));
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al extraer datos");
    } finally {
      setLoading(false);
    }
  };

  // ---- Cost editor ----
  const addCost = (
    kind: AdditionalCostKind,
    label: string,
    applies: AppliesTo
  ) => {
    setCosts((prev) => [...prev, buildAdditionalCost(kind, label, 0, applies)]);
  };
  const updateCost = (id: string, patch: Partial<AdditionalCost>) => {
    setCosts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const removeCost = (id: string) => {
    setCosts((prev) => prev.filter((c) => c.id !== id));
  };

  // ---- Save flow ----
  const buildRateFromRow = (
    row: Record<string, unknown>,
    common: {
      agent: string;
      validFrom: string;
      validTo: string;
      costs: AdditionalCost[];
    },
    idx: number
  ): Rate => {
    // Pre-generate a stable id so React StrictMode's double-invocation can't
    // produce different ids on the two passes.
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const find = (kind: AdditionalCostKind, applies: AppliesTo) =>
      common.costs.find((c) => c.kind === kind && c.applies === applies)
        ?.value ?? 0;
    return {
      id: `rate-${stamp}-${idx}-${rand}`,
      agent: common.agent.trim(),
      carrier: toStr(row.carrier),
      route: toStr(row.route),
      tipo: toStr(row.tipo),
      sf: toNumber(row.sf),
      blFee: toNumber(row.blFee),
      af: toNumber(row.af) || find("agency_fee", "all"),
      afMax: toNumber(row.afMax) || find("agency_fee_max", "all"),
      flexiArg: toNumber(row.flexiArg),
      additionalCosts: common.costs.map((c) => ({ ...c })),
      // Mirror the canonical costs into the legacy fields so the existing
      // invoicing logic (which still reads the fixed shape) keeps working
      // until that layer migrates to additionalCosts.
      thermalLinerChile20: find("thermal_chile", "20"),
      thermalLinerChile40: find("thermal_chile", "40"),
      thermalLinerMendoza20: find("thermal_mendoza", "20"),
      thermalLinerMendoza40: find("thermal_mendoza", "40"),
      fcaHaulageMendoza20: find("fca_haulage_mendoza", "20"),
      fcaHaulageMendoza40: find("fca_haulage_mendoza", "40"),
      discountInsulated: find("discount_insulated", "dry"),
      validFrom: common.validFrom,
      validTo: common.validTo,
      notes: toStr(row.notes),
    };
  };

  const saveSelected = () => {
    if (!resolvedValidity) return;
    if (isEditMode && editingRate && onSaveEdit) {
      const row = previewRows[0]!;
      const updated = buildRateFromRow(
        row,
        { agent, validFrom: resolvedValidity.validFrom, validTo: resolvedValidity.validTo, costs },
        0
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
          agent,
          validFrom: resolvedValidity.validFrom,
          validTo: resolvedValidity.validTo,
          costs,
        },
        idx
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
  const stats = useMemo(() => {
    const total = previewRows.length;
    const ok = previewRows.filter((r) => {
      const carrier = toStr(r.carrier).trim();
      const route = toStr(r.route).trim();
      const sf = toNumber(r.sf);
      return carrier && route && sf > 0;
    }).length;
    return { total, ok, needsReview: total - ok };
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

        {/* Agent input */}
        <Step1AgentField
          agent={agent}
          onChange={setAgent}
          suggestions={agentSuggestions}
          match={agentMatch}
        />

        {/* Validity */}
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

        {/* Costs editor */}
        <Step1CostsEditor
          costs={costs}
          onAdd={addCost}
          onUpdate={updateCost}
          onRemove={removeCost}
        />

        {/* Input zone */}
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
            onChange={(e) => setPasteText(e.target.value)}
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
        {error && <div className="text-sm text-red-600">{error}</div>}

        {step1Errors.length > 0 && (
          <ul className="text-xs text-red-600 list-disc pl-5">
            {step1Errors.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2">
          <Button
            onClick={processAndReview}
            disabled={step1Errors.length > 0 || loading}
          >
            {loading ? "Procesando..." : "Procesar y revisar"}
          </Button>
        </div>
      </div>
    );
  }

  // step === "preview"
  return (
    <PreviewStep
      isEditMode={isEditMode}
      agent={agent}
      validity={resolvedValidity}
      costs={costs}
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

function Step1CostsEditor({
  costs,
  onAdd,
  onUpdate,
  onRemove,
}: {
  costs: AdditionalCost[];
  onAdd: (kind: AdditionalCostKind, label: string, applies: AppliesTo) => void;
  onUpdate: (id: string, patch: Partial<AdditionalCost>) => void;
  onRemove: (id: string) => void;
}) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [otherLabel, setOtherLabel] = useState("");
  const [otherApplies, setOtherApplies] = useState<AppliesTo>("all");
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">Costos adicionales (opcional)</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowQuickAdd((s) => !s)}
        >
          {showQuickAdd ? "Cerrar" : "+ Agregar costo"}
        </Button>
      </div>
      {showQuickAdd && (
        <div className="border border-gray-200 rounded-md p-3 flex flex-col gap-3 bg-gray-50">
          <div className="text-xs text-gray-700">
            Quick add — clic para agregar el costo con valor inicial 0:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_COSTS.map((qc) => (
              <button
                key={qc.label}
                type="button"
                onClick={() => onAdd(qc.kind, qc.label, qc.applies)}
                className="px-2 py-1 text-xs rounded border border-gray-300 bg-white hover:bg-blue-50 cursor-pointer"
              >
                + {qc.label}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-200 pt-3 flex flex-col gap-2">
            <div className="text-xs text-gray-700">
              O agregá un costo personalizado (kind = &quot;other&quot;):
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <input
                type="text"
                value={otherLabel}
                onChange={(e) => setOtherLabel(e.target.value)}
                placeholder="Label (ej: Surcharge BL)"
                className="flex-1 border border-gray-200 rounded p-1.5 h-9 text-sm bg-white"
              />
              <select
                value={otherApplies}
                onChange={(e) => setOtherApplies(e.target.value as AppliesTo)}
                className="border border-gray-200 rounded p-1.5 h-9 text-sm bg-white"
              >
                <option value="all">Aplica a todos</option>
                <option value="20">Solo 20&apos;</option>
                <option value="40">Solo 40&apos;</option>
                <option value="dry">Solo Dry</option>
                <option value="reefer">Solo Reefer</option>
              </select>
              <Button
                size="sm"
                onClick={() => {
                  const lbl = otherLabel.trim();
                  if (!lbl) return;
                  onAdd("other", lbl, otherApplies);
                  setOtherLabel("");
                  setOtherApplies("all");
                }}
              >
                Agregar
              </Button>
            </div>
          </div>
        </div>
      )}
      {costs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {costs.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 border border-gray-200 rounded-md p-2 bg-white text-xs"
            >
              <input
                type="text"
                value={c.label}
                onChange={(e) => onUpdate(c.id, { label: e.target.value })}
                className="flex-1 border border-gray-200 rounded p-1 h-8"
              />
              <input
                type="number"
                value={c.value}
                onChange={(e) =>
                  onUpdate(c.id, { value: Number(e.target.value) })
                }
                className="w-24 border border-gray-200 rounded p-1 h-8"
              />
              <select
                value={c.applies}
                onChange={(e) =>
                  onUpdate(c.id, { applies: e.target.value as AppliesTo })
                }
                className="border border-gray-200 rounded p-1 h-8 bg-white"
              >
                <option value="all">todos</option>
                <option value="20">20&apos;</option>
                <option value="40">40&apos;</option>
                <option value="dry">dry</option>
                <option value="reefer">reefer</option>
              </select>
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                className="text-red-600 hover:bg-red-50 rounded px-2 py-1 cursor-pointer"
                aria-label="Eliminar costo"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Step 2 — Preview / Edit
// ============================================================================

function PreviewStep({
  isEditMode,
  agent,
  validity,
  costs,
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
  costs: AdditionalCost[];
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
  const visibleRows = filterToReview
    ? rows
        .map((r, i) => ({ r, i }))
        .filter(
          ({ r }) =>
            !(
              String(r.carrier ?? "").trim() &&
              String(r.route ?? "").trim() &&
              Number(r.sf ?? 0) > 0
            )
        )
    : rows.map((r, i) => ({ r, i }));

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
        {costs.length > 0 && (
          <div>
            <strong>Costos adicionales:</strong>{" "}
            {costs
              .map((c) => `${c.label} = $${c.value}`)
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
              {["Carrier", "Ruta", "Tipo", "SF", "BL Fee", "Acciones"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {visibleRows.map(({ r, i: idx }) => {
              const isSelected = selected.has(idx);
              const isEditing = editingIdx === idx;
              const carrier = String(r.carrier ?? "");
              const carrierBg = carrier ? carrierColor(carrier) : undefined;
              const needsReview =
                !(
                  String(r.carrier ?? "").trim() &&
                  String(r.route ?? "").trim() &&
                  Number(r.sf ?? 0) > 0
                );
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
                      <td
                        colSpan={isEditMode ? 6 : 7}
                        className="px-3 py-3"
                      >
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
                          <RowNumField
                            label="AF"
                            row={r}
                            field="af"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RowNumField
                            label="AF Max"
                            row={r}
                            field="afMax"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RowNumField
                            label="Flexi ARG"
                            row={r}
                            field="flexiArg"
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
        {CONTAINER_TYPE_SUGGESTIONS.map((t) => (
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

