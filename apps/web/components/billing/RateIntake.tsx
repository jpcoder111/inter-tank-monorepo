"use client";

import { Fragment, useRef, useState } from "react";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/Button";

type IntakeType = "rate" | "ebs" | "local_std" | "local_exception";
type Mode = "choose" | "image" | "excel" | "manual";

const STRICT_RESPONSE_RULES = `IMPORTANTE: Respondé SOLO con el JSON, sin backticks de markdown (\`\`\`), sin texto adicional antes o después. Si hay muchas tarifas, limitá la respuesta a las primeras 20.`;

// Same formatting discipline but no row cap — used for prompts where the user
// expects every input row to round-trip into a result (rates extraction).
const STRICT_RESPONSE_RULES_NO_LIMIT = `IMPORTANTE: Respondé SOLO con el JSON, sin backticks de markdown (\`\`\`), sin texto adicional antes o después.`;

const RATE_SYSTEM = `Sos un extractor de tarifas de fletes marítimos. El input puede contener UNA o MÚLTIPLES tarifas (por ejemplo, un Excel con muchas filas, una por tarifa).

Extrae las tarifas que encuentres en el input. Devolvé un JSON ARRAY con un objeto por cada tarifa/fila.

LÍMITE: Si el Excel tiene más de 30 tarifas distintas, devolvé las primeras 30 y agregá un campo extra \`"truncated": true\` SOLO en el último objeto del array. Si hay 30 o menos tarifas, NO agregues el campo truncated. El frontend muestra un aviso cuando ve truncated:true para que el usuario suba el resto del Excel.

Si solo hay una tarifa, devolvé un array con un único elemento. Usá "" para strings faltantes y 0 para números faltantes. No incluyas comentarios ni texto adicional.

[
  {
    "agent": string,                   // nombre del agente (IWS, Van Moer, Asstra, HCL, Scan, CCL, BULLET u otro)
    "carrier": string,                 // naviera (OOCL, HAPAG, CMA-CGM, PIL, COSCO, Evergreen, MSC u otra)
    "route": string,                   // ruta o puerto de destino
    "tipo": string,                    // tipo de contenedor (20', Flexi, 20'-Flexi, 40', 40'HC, 20'RF, 40'RF)
    "sf": number,                      // Sea Freight en USD por contenedor
    "blFee": number,                   // BL fee en USD por BL
    "af": number,                      // Agency fee por contenedor
    "afMax": number,                   // AF máximo por BL/operación
    "flexiArg": number,                // cargo adicional Flexi ARG
    "thermalLinerChile20": number,     // Thermal Liner / Insulado para 20' desde Chile (0 si el agente no cobra)
    "thermalLinerChile40": number,     // Thermal Liner / Insulado para 40' desde Chile (0 si el agente no cobra)
    "thermalLinerMendoza20": number,   // Thermal Liner / Insulado para 20' desde Mendoza (0 si el agente no cobra)
    "thermalLinerMendoza40": number,   // Thermal Liner / Insulado para 40' desde Mendoza (0 si el agente no cobra)
    "fcaHaulageMendoza20": number,     // FCA Haulage / trucking desde Mendoza para 20' (0 si no aplica)
    "fcaHaulageMendoza40": number,     // FCA Haulage / trucking desde Mendoza para 40' (0 si no aplica)
    "discountInsulated": number,       // descuento USD si la carga va insulada (0 si no aplica)
    "additionalNotes": string,         // condiciones extra como "descuento aplica solo si carga insulada" ("" si no hay)
    "validFrom": string,               // YYYY-MM-DD
    "validTo": string,                 // YYYY-MM-DD
    "notes": string                    // cualquier observación relevante (incluido all-in, EBS variable, etc.)
  }
]

CÓMO APLICAR LOS COSTOS ADICIONALES (CRÍTICO):

Estos costos son GENERALES del agente y deben repetirse en CADA objeto del array. Si el agente cobra Thermal Liner, AMBOS valores (20' y 40') tienen que llenarse en CADA tarifa, sin importar si la tarifa específica es 20' o 40'. Por ejemplo si el agente tiene Thermal Chile 200/300, TODAS las tarifas del agente deben tener thermalLinerChile20=200 y thermalLinerChile40=300 — incluso una tarifa que es solo 40' debe tener thermalLinerChile20=200 (porque podría facturarse en 20' después). Lo mismo para Mendoza y para FCA Haulage.

Reglas específicas:

- **Thermal Liner Chile**: si el Excel declara un Thermal Liner desde Chile (Valparaíso, San Antonio u otro puerto chileno), poné AMBOS thermalLinerChile20 y thermalLinerChile40 en TODAS las tarifas del agente. NO solo en filas que sean 20' o 40' — en TODAS, con AMBOS valores.
- **Thermal Liner Mendoza**: si el Excel declara un Thermal Liner desde Mendoza (Argentina), poné AMBOS thermalLinerMendoza20 y thermalLinerMendoza40 en TODAS las tarifas del agente, con AMBOS valores.
- **FCA Haulage Mendoza**: si el Excel declara FCA Haulage / transporte terrestre desde Mendoza (ej: 2170/2270 para 20'/40'), poné AMBOS fcaHaulageMendoza20 y fcaHaulageMendoza40 en TODAS las tarifas del agente que cubran origen Mendoza, con AMBOS valores. Tarifas que claramente NO admiten origen Mendoza llevan 0.
- **Descuento por insulado**: si el Excel menciona "descuento de USD X si la carga va insulada", aplicá discountInsulated en TODAS las tarifas Dry del agente. additionalNotes debe describir la condición ("Descuento aplica solo si carga insulada") en cada fila que tenga el descuento.

NUNCA dejes una fila con 0 cuando le correspondería el valor del agente. Si el agente cobra Thermal Liner Chile 200/300, ese par 200/300 va en TODAS las filas del agente — repetido textualmente.

${STRICT_RESPONSE_RULES_NO_LIMIT}`;

// One-shot prompt that resolves the agent-wide additional costs from a notes
// blob. The chunked extraction calls this ONCE upfront (not per chunk) and
// then applies the resolved values per row in code based on each row's POL.
// Mendoza values stay 0 if the input only mentions Chile — we don't infer.
const PREAMBLE_RESOLUTION_SYSTEM = `Sos un extractor de costos adicionales de tarifas de fletes marítimos. El input contiene notas sobre Thermal Liner / Insulado, FCA Haulage / transporte terrestre desde Mendoza, y descuento por carga insulada.

Devolvé SOLO un objeto JSON con los 7 campos siguientes. Si el input NO menciona un valor específico, devolvé 0 — NO inventes ni copies entre Chile y Mendoza.

{
  "thermalLinerChile20": number,    // USD para Thermal Liner desde Chile, 20'
  "thermalLinerChile40": number,    // mismo para 40'
  "thermalLinerMendoza20": number,  // USD para Thermal Liner desde Mendoza, 20'
  "thermalLinerMendoza40": number,  // mismo para 40'
  "fcaHaulageMendoza20": number,    // FCA Haulage / trucking desde Mendoza, 20'
  "fcaHaulageMendoza40": number,    // mismo para 40'
  "discountInsulated": number       // descuento USD si la carga va insulada (aplica a tarifas dry)
}

Si el input solo menciona Thermal Liner Chile y nada para Mendoza, los Mendoza quedan en 0 (NO asumir igual a Chile). Mismo principio inverso.

IMPORTANTE: Respondé SOLO con el objeto JSON, sin backticks de markdown, sin texto adicional.`;

// Slim per-chunk prompt: NO menciona thermal/haulage/discount. El frontend
// los rellena después usando los valores ya resueltos por
// PREAMBLE_RESOLUTION_SYSTEM y la detección de origen por POL. Esta versión
// pide explícitamente el campo POL para que el código pueda elegir
// Chile vs Mendoza.
const RATE_CHUNK_SYSTEM = `Sos un extractor de tarifas de fletes marítimos. El input contiene una tabla con tarifas (una por fila).

Extrae las tarifas. Devolvé un JSON ARRAY con un objeto por cada tarifa/fila. Si el input no es una tabla o no contiene tarifas, devolvé un array vacío.

[
  {
    "agent": string,         // agente logístico (IWS, Van Moer, Asstra, HCL, Scan, CCL, BULLET u otro)
    "carrier": string,       // naviera (OOCL, HAPAG, CMA-CGM, etc.)
    "route": string,         // ruta o puerto de destino
    "tipo": string,          // tipo de contenedor (20', Flexi, 20'-Flexi, 40', 40'HC, 20'RF, 40'RF)
    "sf": number,            // Sea Freight USD por contenedor
    "blFee": number,         // BL fee USD por BL
    "af": number,            // Agency fee por contenedor
    "afMax": number,         // AF máximo
    "flexiArg": number,      // cargo Flexi ARG
    "validFrom": string,     // YYYY-MM-DD
    "validTo": string,       // YYYY-MM-DD
    "notes": string          // observación relevante
  }
]

Usá "" para strings faltantes y 0 para números faltantes. NO incluyas thermalLiner, fcaHaulage ni discountInsulated — el frontend rellena esos campos después.

${STRICT_RESPONSE_RULES_NO_LIMIT}`;

const EBS_SYSTEM = `Sos un extractor de EBS (Emergency Bunker Surcharge) para fletes marítimos.

CONTEXTO IMPORTANTE:
- El EBS se expresa SIEMPRE por TEU (20' = 1 TEU, 40' = 2 TEU). Si el input da el valor por contenedor de 40', dividilo por 2.
- Cada item tiene un TIPO: "Dry" o "Reefer". Si el input distingue tarifas distintas para Dry y Reefer (ej: "Reefer +20%" o columnas separadas), generá DOS items separados — uno por cada tipo, con su propio amountPerTEU. Si el input no menciona reefer, asumí "Dry".
- El EBS aplica por REGIÓN/TRÁFICO, no por puerto específico. La lista CANÓNICA de regiones es: "Chile - Norte de Europa", "Chile - USA", "Chile - Canadá", "Chile - Asia", "Chile - Intraamérica", "Chile - Mediterráneo", "Chile - Oceanía". Mapeá siempre al valor canónico — no inventes regiones nuevas.
- Ejemplos de mapeo: "Europa", "NEUR", "Norte EU", "Rotterdam/Hamburg" → "Chile - Norte de Europa"; "USA", "NA", "USEC", "USWC" → "Chile - USA"; "Canadá", "Vancouver", "Montreal" → "Chile - Canadá"; "Asia", "FE", "Far East", "Shanghai", "Busan" → "Chile - Asia"; "Sudamérica", "Brasil", "Perú", "Colombia" → "Chile - Intraamérica"; "Med", "Mediterráneo", "Italia", "España" → "Chile - Mediterráneo"; "Oceanía", "Australia", "NZ" → "Chile - Oceanía".
- Las fechas suelen estar en formato dd/mm o dd-mm. Si no hay año explícito, asumí el año actual. "onwards" o similar significa que validTo queda vacío ("").

FORMATO TÍPICO (Excel agrupado por naviera):
El input puede venir con BLOQUES separados por líneas en blanco. Cada bloque suele contener:
1. Una línea con el nombre de la NAVIERA y posiblemente un periodo de vigencia (ej: "OOCL | 15/4 al 1/5").
2. Una o más líneas con REGIÓN + monto por TEU (ej: "Europa | US$ 266 teu").

Por cada combinación naviera+región generá UN ITEM. La naviera y la vigencia se heredan del bloque correspondiente.

Devolvé SOLO un ARRAY JSON con uno o más objetos. Usá "" para strings faltantes y 0 para números faltantes. No incluyas comentarios, markdown ni texto adicional.

[
  {
    "carrier": string,         // naviera (OOCL, HAPAG, CMA-CGM, etc.)
    "traffic": string,         // región/tráfico canónico (ej: "Chile - Norte de Europa")
    "tipo": "Dry" | "Reefer",  // tipo de carga al que aplica esta tarifa
    "amountPerTEU": number,    // monto en USD por TEU (= valor 40' / 2)
    "validFrom": string,       // YYYY-MM-DD
    "validTo": string,         // YYYY-MM-DD ("" si dice "onwards" o no tiene fin)
    "notes": string            // observación (unidad original si fue /ctr, exclusiones, etc.)
  }
]

Si solo hay un EBS en el input, devolvé un array con un único elemento. NUNCA devuelvas un objeto suelto.

${STRICT_RESPONSE_RULES}`;

const LOCAL_STD_SYSTEM = `Sos un extractor de TARIFAS ESTÁNDAR de gastos locales portuarios (OTHC, sello, AMS, BL Fee, Gate Out).
Devolvé SOLO un objeto JSON con los siguientes campos. Usá "" para strings faltantes y 0 para números faltantes. No incluyas comentarios, markdown ni texto adicional.

{
  "name": string,              // nombre de la tarifa (ej: "Estándar", "San Clemente")
  "othcDry": number,           // OTHC Dry USD/unidad
  "othcReefer": number,        // OTHC Reefer USD/unidad
  "sello": number,             // Sello USD/unidad
  "ams": number,               // AMS USD/BL
  "blFee": number,             // BL Fee USD/BL
  "gateOutDry": number,        // Gate Out Dry USD/unidad
  "gateOutReefer": number,     // Gate Out Reefer USD/unidad
  "gateOutConditions": string, // condiciones de aplicación de Gate Out (navieras, destinos)
  "validFrom": string,         // YYYY-MM-DD
  "notes": string              // cualquier observación
}

${STRICT_RESPONSE_RULES}`;

const LOCAL_EXCEPTION_SYSTEM = `Sos un extractor de EXCEPCIONES de gastos locales portuarios por cliente/naviera.
Devolvé SOLO un objeto JSON con los siguientes campos. Usá "" para strings faltantes y 0 para números faltantes. El tipo debe ser "Dry" o "Reefer". No incluyas comentarios, markdown ni texto adicional.

{
  "customer": string,            // cliente (ej: "Concha y Toro", "Mipster – IWS", "De Martino / Santa Teresa")
  "carrier": string,             // naviera (ej: "OOCL", "Evergreen", "CMA CGM", "Yang Ming", "Todas las navieras")
  "tipo": "Dry" | "Reefer",
  "othc": number,                // USD/unidad
  "sello": number,               // USD/unidad (puede ser 0)
  "ams": number,                 // USD/BL (puede ser 0)
  "blFee": number,               // USD/BL (puede ser 0)
  "gateOut": number,             // USD/unidad (0 si no aplica)
  "gateOutPorts": string,        // puertos donde aplica Gate Out
  "gateOutUnitTypes": string,    // tipos de unidad donde aplica Gate Out
  "otherCharges": number,        // cargos adicionales USD/unidad (0 si no hay)
  "otherChargesDetail": string,  // descripción de los otros cargos (ej: "Security Surcharge 10/unit + TPO TPA 12/unit")
  "notes": string,
  "validFrom": string            // YYYY-MM-DD
}

${STRICT_RESPONSE_RULES}`;

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

// Strips trailing empty cells, drops all-empty (comma-only) rows by emptying them,
// and collapses runs of blank lines into a single blank — preserving block separators
// for grouped formats while removing CSV noise.
function cleanCsvText(raw: string): string {
  const lines = raw.split(/\r?\n/).map((line) => {
    const trimmed = line.replace(/,+\s*$/, "").trimEnd();
    return /^[,\s]*$/.test(trimmed) ? "" : trimmed;
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Hard cap so Claude's response stays well under max_tokens. Empirically a
// row of EBS data parses to ~80 tokens; 150 rows leaves headroom under the
// 8192 max_tokens cap on the API route.
const EXCEL_MAX_ROWS = 150;
// Hard cap on the text payload sent to the API. Vercel serverless input is
// generously sized but Claude generation cost scales with input tokens, and
// >15k chars of CSV usually means we have a misshapen sheet anyway.
const EXCEL_MAX_CHARS = 15000;

type ExcelReadResult = {
  text: string;
  totalRows: number;
  usedRows: number;
  truncated: boolean;
  charTruncated: boolean;
};

function csvEscapeCell(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Splits an Excel-derived CSV into chunks of CHUNK_DATA_ROWS data rows each,
// repeating the header line at the top of every chunk so each independent API
// call has the same column context. "Hoja: <name>" markers and blank lines are
// dropped — the returned chunks are pure header + data CSV.
// 15 keeps each Claude call short enough that single-call truncation is
// rare even on rate-heavy formats. Lower than this just multiplies API
// round-trips for negligible gain.
const CHUNK_DATA_ROWS = 15;

// Lines mentioning these keywords typically describe agent-wide additional
// costs (Thermal Liner, FCA Haulage, insulated discount, etc.) that live in
// notes/footer rows outside the main rate table. We prepend them to every
// chunk so Claude has the context to populate thermalLiner/fcaHaulage/
// discountInsulated on rows that don't carry the values inline.
const PREAMBLE_KEYWORDS =
  /thermal\s*liner|fca\s*haulage|insulated|insulado|refuerzo/i;

// True commas-per-line threshold for a line to be treated as a "note" rather
// than a data row. Data rows in Excel-derived CSVs almost always have more
// than 3 commas; notes/headers typically have 0-3.
const PREAMBLE_MAX_COMMAS = 3;

function extractContextPreamble(text: string): string {
  const matches: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("Hoja:")) continue;
    if (!PREAMBLE_KEYWORDS.test(line)) continue;
    const commaCount = (line.match(/,/g) ?? []).length;
    if (commaCount > PREAMBLE_MAX_COMMAS) continue;
    matches.push(line);
  }
  return matches.join("\n");
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

async function readExcelAsText(file: File): Promise<ExcelReadResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheets: string[] = [];
  let totalRows = 0;
  let usedRows = 0;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    // sheet_to_json with header:1 returns array-of-arrays — easier to drop
    // entirely-empty columns (a major source of payload bloat in exports
    // that include unused columns far to the right of the data).
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

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const LARGE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function isDocx(file: File): boolean {
  return file.name.toLowerCase().endsWith(".docx") || file.type === DOCX_MIME;
}

async function readDocxAsText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

// Removes ALL ```...``` fence markers from the text — opener (with optional
// language hint) and closer alike, regardless of position. Claude sometimes
// prepends prose like "Aquí está el JSON:" before opening a fence; the prior
// implementation only stripped fences that hugged the string boundaries and
// that was leaving stray backticks inside extractJsonRegion's slice.
function stripCodeFences(s: string): string {
  return s
    .replace(/```(?:json|JSON|js|JS)?\s*\n?/g, "")
    .replace(/```/g, "")
    .trim();
}

// Slice from the first opening bracket/brace to the last matching closer.
// Drops any prose Claude prepended ("Here's the JSON:") or appended.
function extractJsonRegion(s: string): string {
  const firstBracket = s.indexOf("[");
  const firstBrace = s.indexOf("{");
  const lastBracket = s.lastIndexOf("]");
  const lastBrace = s.lastIndexOf("}");
  // Prefer array form: our extraction prompts return arrays. Treat the array
  // as the outer container only when its span fully contains the brace span.
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

// When Claude truncates mid-response (max_tokens hit, network cut, etc.) the
// JSON ends mid-object with unclosed `{` and `[`. We walk the string, respecting
// quoted strings and escapes, count unclosed openers, then append the missing
// closers. Heuristic: close braces before brackets — works for the common case
// of `[ {…}, { … ` truncation but won't repair every shape.
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
  // A truncation mid-array often leaves a dangling comma; strip it before
  // closing or JSON.parse will choke on `, ]`.
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

// Aggressive cleanup for the manual retry path: removes JS-style comments
// and trailing commas before re-running the standard pipeline. Used only when
// the user asks to retry parsing — we don't want to silently rewrite content
// on the first attempt.
function aggressiveClean(s: string): string {
  let out = stripCodeFences(s);
  out = extractJsonRegion(out);
  // Strip // line comments (only outside strings — naive impl, but Claude's
  // outputs rarely contain "//" inside strings).
  out = out.replace(/\/\/[^\n\r]*/g, "");
  // Strip /* ... */ block comments
  out = out.replace(/\/\*[\s\S]*?\*\//g, "");
  // Drop trailing commas before } or ]
  out = out.replace(/,(\s*[}\]])/g, "$1");
  out = autoCloseJson(out);
  return out;
}

// Walks an array-shaped JSON string from `[`, collecting only complete top-level
// objects. Stops at the first object that's truncated (mid-object, unmatched
// braces). This is the most robust path for max_tokens-truncated responses —
// it never invents content, just keeps what's intact. Returns undefined if no
// `[` was found or no complete objects could be extracted.
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
    if (c !== "{") break; // unexpected char outside an object — stop collecting
    // Find the matching closing brace for the object that starts at i.
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
    if (end === -1) break; // truncated mid-object — stop, return what we have
    try {
      out.push(JSON.parse(s.slice(i, end + 1)) as Record<string, unknown>);
    } catch {
      break; // malformed object — stop collecting
    }
    i = end + 1;
  }
  return out.length > 0 ? out : undefined;
}

export type ParseResult = {
  data: Record<string, unknown> | Record<string, unknown>[];
  // True when the standard JSON.parse failed and we had to recover via
  // autoCloseJson or recoverJsonArray. The caller surfaces a warning.
  partial: boolean;
};

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
    // Fallback 1: close dangling brackets/braces.
    try {
      const closed = autoCloseJson(region);
      return {
        data: JSON.parse(closed) as
          | Record<string, unknown>
          | Record<string, unknown>[],
        partial: true,
      };
    } catch {
      // Fallback 2: walk the array and collect what's fully intact.
      const recovered = recoverJsonArray(region);
      if (recovered) return { data: recovered, partial: true };
      throw new Error("No se pudo recuperar JSON parseable");
    }
  }
}

function parseExtractedJsonAggressive(raw: string): ParseResult {
  const cleaned = aggressiveClean(raw);
  try {
    return {
      data: JSON.parse(cleaned) as
        | Record<string, unknown>
        | Record<string, unknown>[],
      partial: false,
    };
  } catch {
    const recovered = recoverJsonArray(cleaned);
    if (recovered) return { data: recovered, partial: true };
    throw new Error("No se pudo recuperar JSON parseable (modo agresivo)");
  }
}

function toRecordArray(
  parsed: Record<string, unknown> | Record<string, unknown>[]
): Record<string, unknown>[] {
  if (Array.isArray(parsed)) return parsed;
  // tolerate { items: [...] } / { results: [...] } envelopes
  for (const key of ["items", "results", "ebs", "rates"]) {
    const v = (parsed as Record<string, unknown>)[key];
    if (Array.isArray(v)) return v as Record<string, unknown>[];
  }
  return [parsed];
}

export default function RateIntake({
  type,
  onExtracted,
  onExtractedMany,
  onCancel,
}: {
  type: IntakeType;
  onExtracted: (data: Record<string, unknown>) => void;
  onExtractedMany?: (rows: Record<string, unknown>[]) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<Mode>("choose");
  const [manualText, setManualText] = useState("");
  const [fileName, setFileName] = useState("");
  const [imageData, setImageData] = useState<
    { base64: string; mediaType: string } | null
  >(null);
  const [docxText, setDocxText] = useState("");
  const [excelText, setExcelText] = useState("");
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Multi-result preview (currently used for EBS where one upload yields N rows)
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[] | null>(
    null
  );
  const [previewSelected, setPreviewSelected] = useState<Set<number>>(new Set());
  const [previewWarning, setPreviewWarning] = useState<string | null>(null);
  // Set while chunked Excel extraction is in flight: shows the user which
  // chunk is being processed and lets us hide the form/intake mid-run.
  const [chunkProgress, setChunkProgress] = useState<
    { current: number; total: number; retrying?: boolean } | null
  >(null);
  // Captures the chunks that failed all 3 attempts so the user can manually
  // retry just those without re-running the successful ones.
  const [failedChunkInfo, setFailedChunkInfo] = useState<
    Array<{ index: number; content: string }> | null
  >(null);
  // Cached resolved additional costs from the most recent submitChunked run.
  // retryFailedChunks reuses these so recovered rows pick the same
  // Chile/Mendoza values that the originally-successful chunks did.
  const [retryResolvedCosts, setRetryResolvedCosts] = useState<{
    thermalLinerChile20: number;
    thermalLinerChile40: number;
    thermalLinerMendoza20: number;
    thermalLinerMendoza40: number;
    fcaHaulageMendoza20: number;
    fcaHaulageMendoza40: number;
    discountInsulated: number;
  } | null>(null);
  // Raw Claude response when JSON parse fails — user can edit and retry
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const excelInput = useRef<HTMLInputElement>(null);

  const system =
    type === "rate"
      ? RATE_SYSTEM
      : type === "ebs"
        ? EBS_SYSTEM
        : type === "local_std"
          ? LOCAL_STD_SYSTEM
          : LOCAL_EXCEPTION_SYSTEM;

  const resetMode = () => {
    setMode("choose");
    setManualText("");
    setFileName("");
    setImageData(null);
    setDocxText("");
    setExcelText("");
    setSizeWarning(null);
    setError(null);
    setPreviewRows(null);
    setPreviewSelected(new Set());
    setPreviewWarning(null);
    setRawResponse(null);
    setChunkProgress(null);
    setFailedChunkInfo(null);
    setRetryResolvedCosts(null);
  };

  // Multi-row mode is enabled when the parent passed onExtractedMany. EBS uploads
  // can describe several carrier+region rows in one document, so we never want
  // those rolled up into a single form.
  const supportsMany = Boolean(onExtractedMany);

  const consumeParsed = (result: ParseResult) => {
    const rawRows = toRecordArray(result.data);
    // Claude marks the last row with `truncated: true` when the source had
    // more than 30 tarifas. Treat that field as metadata: use it to surface
    // a warning, then strip it from the rows we save.
    const claudeMarkedTruncated = rawRows.some(
      (r) => r.truncated === true
    );
    const rows = rawRows.map((r) => {
      if ("truncated" in r) {
        const { truncated: _t, ...rest } = r;
        void _t;
        return rest;
      }
      return r;
    });

    let warning: string | null = null;
    if (claudeMarkedTruncated) {
      warning = `Se extrajeron las primeras ${rows.length} tarifas — el Excel tenía más. Para el resto, sube el Excel nuevamente seleccionando otro rango.`;
    } else if (result.partial) {
      warning = `Se extrajeron ${rows.length} tarifas, pero la respuesta de Claude llegó truncada. Es posible que falten algunas — subí el Excel nuevamente si esperabas más.`;
    }

    if (supportsMany) {
      setPreviewRows(rows);
      setPreviewSelected(new Set(rows.map((_, i) => i)));
      setPreviewWarning(warning);
      setRawResponse(null);
      return;
    }
    // Single-row consumers: hand them the first object.
    onExtracted((rows[0] ?? {}) as Record<string, unknown>);
  };

  const handleImage = async (file: File) => {
    setError(null);
    setFileName(file.name);
    setImageData(null);
    setDocxText("");
    if (file.size > LARGE_FILE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setSizeWarning(
        `Archivo muy grande (${mb} MB) — se recomienda usar una imagen o texto en su lugar.`
      );
    } else {
      setSizeWarning(null);
    }
    try {
      if (isDocx(file)) {
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

  const handleExcel = async (file: File) => {
    setError(null);
    setSizeWarning(null);
    setFileName(file.name);
    try {
      const result = await readExcelAsText(file);
      if (!result.text.trim()) {
        setError("El Excel no contiene datos.");
        return;
      }
      setExcelText(result.text);
      const warnings: string[] = [];
      if (result.truncated) {
        warnings.push(
          `Excel tiene ${result.totalRows} filas — se procesarán las primeras ${result.usedRows}. Para el resto, sube el archivo nuevamente seleccionando otro rango.`
        );
      }
      if (result.charTruncated) {
        warnings.push(
          `El texto excede ${EXCEL_MAX_CHARS} caracteres — se truncó antes de enviarlo a Claude (las últimas filas pueden quedar afuera).`
        );
      }
      if (warnings.length > 0) setSizeWarning(warnings.join(" "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al leer Excel");
    }
  };

  const callExtractApi = async (
    content: string | ContentPayload,
    systemOverride?: string
  ): Promise<{ rows: Record<string, unknown>[]; partial: boolean }> => {
    const res = await fetch("/api/billing/extract-rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: systemOverride ?? system, content }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `API error ${res.status}`);
    }
    const { text: responseText } = (await res.json()) as { text: string };
    const parsed = parseExtractedJson(responseText);
    return { rows: toRecordArray(parsed.data), partial: parsed.partial };
  };

  // Multiple sequential API calls so each chunk fits comfortably in
  // max_tokens. Per-chunk failures are collected into `failedChunks` so the
  // user gets partial results plus a precise list of which blocks to retry.
  // 3 total attempts per chunk with a 5s backoff between attempts. The
  // 5s gives rate-limit windows time to reset and reduces overlap with the
  // platform's request-coalescing.
  const MAX_CHUNK_ATTEMPTS = 3;
  const RETRY_DELAY_MS = 5000;

  const stripTruncatedField = (r: Record<string, unknown>) => {
    if (!("truncated" in r)) return r;
    const { truncated: _t, ...rest } = r;
    void _t;
    return rest;
  };

  // Runs a list of chunk requests sequentially with the retry policy. Used
  // by both the initial chunked extraction and the manual "retry failed
  // chunks" action so retry semantics stay consistent.
  const processChunks = async (
    items: Array<{ index: number; content: string }>,
    totalForUi: number,
    systemOverride?: string
  ) => {
    const rows: Record<string, unknown>[] = [];
    const failed: Array<{ index: number; content: string }> = [];
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
          const result = await callExtractApi(item.content, systemOverride);
          rows.push(...result.rows);
          if (result.partial) partial = true;
          success = true;
        } catch {
          // fall through and retry until MAX_CHUNK_ATTEMPTS exhausted
        }
      }
      if (!success) failed.push(item);
    }
    return { rows, failed, partial };
  };

  const buildChunkItems = (
    chunks: string[],
    preamble: string
  ): Array<{ index: number; content: string }> =>
    chunks.map((c, i) => {
      const dataPart = `Datos del Excel (bloque ${i + 1} de ${chunks.length}):\n\n${c}`;
      return {
        index: i + 1,
        content: preamble
          ? `Contexto general del Excel (aplica a TODAS las filas, no es una fila de tarifa):\n${preamble}\n\n${dataPart}`
          : dataPart,
      };
    });

  // Type-aware system override for chunked calls. Rate Excels go through the
  // slim per-chunk prompt (no thermal/haulage fields — code applies them);
  // EBS chunks keep the regular EBS_SYSTEM.
  const chunkSystemOverride: string | undefined =
    type === "rate" ? RATE_CHUNK_SYSTEM : undefined;

  type ResolvedAdditionalCosts = {
    thermalLinerChile20: number;
    thermalLinerChile40: number;
    thermalLinerMendoza20: number;
    thermalLinerMendoza40: number;
    fcaHaulageMendoza20: number;
    fcaHaulageMendoza40: number;
    discountInsulated: number;
  };

  const ZERO_RESOLVED: ResolvedAdditionalCosts = {
    thermalLinerChile20: 0,
    thermalLinerChile40: 0,
    thermalLinerMendoza20: 0,
    thermalLinerMendoza40: 0,
    fcaHaulageMendoza20: 0,
    fcaHaulageMendoza40: 0,
    discountInsulated: 0,
  };

  // Single upfront call to resolve the agent-wide costs. Caller decides
  // what context to feed (filtered preamble notes or a slice of the raw
  // Excel CSV). Returns all-zero on empty input or call failure so the
  // pipeline never hard-stops on the resolution step.
  const resolvePreambleCosts = async (
    contextText: string
  ): Promise<ResolvedAdditionalCosts> => {
    if (!contextText.trim()) return ZERO_RESOLVED;
    try {
      const result = await callExtractApi(
        `Contenido del Excel:\n\n${contextText}`,
        PREAMBLE_RESOLUTION_SYSTEM
      );
      const obj = (result.rows[0] ?? {}) as Record<string, unknown>;
      const num = (k: string) => {
        const v = obj[k];
        return typeof v === "number" && Number.isFinite(v)
          ? v
          : typeof v === "string" && v.trim()
            ? Number(v.replace(/[^0-9.-]/g, "")) || 0
            : 0;
      };
      return {
        thermalLinerChile20: num("thermalLinerChile20"),
        thermalLinerChile40: num("thermalLinerChile40"),
        thermalLinerMendoza20: num("thermalLinerMendoza20"),
        thermalLinerMendoza40: num("thermalLinerMendoza40"),
        fcaHaulageMendoza20: num("fcaHaulageMendoza20"),
        fcaHaulageMendoza40: num("fcaHaulageMendoza40"),
        discountInsulated: num("discountInsulated"),
      };
    } catch {
      return ZERO_RESOLVED;
    }
  };

  // Stores ALL 7 resolved cost fields on every rate. Rates extracted from an
  // agent quote are generic — they don't know who the eventual shipper will
  // be — so both Chile and Mendoza values travel with each rate. Invoicing
  // (InvoicingTab) decides Chile-vs-Mendoza per BL using the shipper match
  // against the ARG clients list.
  const applyAdditionalCosts = (
    row: Record<string, unknown>,
    resolved: ResolvedAdditionalCosts
  ): Record<string, unknown> => ({
    ...row,
    thermalLinerChile20: resolved.thermalLinerChile20,
    thermalLinerChile40: resolved.thermalLinerChile40,
    thermalLinerMendoza20: resolved.thermalLinerMendoza20,
    thermalLinerMendoza40: resolved.thermalLinerMendoza40,
    fcaHaulageMendoza20: resolved.fcaHaulageMendoza20,
    fcaHaulageMendoza40: resolved.fcaHaulageMendoza40,
    discountInsulated: resolved.discountInsulated,
  });

  const submitChunked = async () => {
    if (!excelText) return;
    const chunks = chunkExcelCsv(excelText);
    const preamble = extractContextPreamble(excelText);
    // Step 1: resolve the agent-wide costs ONCE upfront. Skipped for EBS
    // (no preamble keywords expected there). The keyword-based preamble
    // extraction misses Excels where Thermal/Haulage values live in columns
    // (data rows have too many commas to pass the threshold), so when the
    // preamble comes up short we pass the start of the raw CSV instead —
    // Claude is good at finding "Thermal Liner: X" mentions even in
    // column-shaped data.
    const resolveContext =
      preamble.trim().length > 50 ? preamble : excelText.slice(0, 6000);
    const resolved =
      type === "rate"
        ? await resolvePreambleCosts(resolveContext)
        : ZERO_RESOLVED;
    // [debug-rate] temp: confirm what we sent to step 1 and what came back
    console.log(
      "[debug-rate] preamble length:",
      preamble.length,
      "preamble preview:",
      preamble.slice(0, 300)
    );
    console.log(
      "[debug-rate] resolveContext used:",
      resolveContext === preamble ? "preamble" : "excelText slice",
      "length:",
      resolveContext.length
    );
    console.log("[debug-rate] resolved costs:", resolved);
    // For rate chunks we no longer prepend the preamble — Claude doesn't
    // need it (we're filling those values in code). For EBS we keep the
    // existing preamble-prepended payload.
    const items =
      type === "rate"
        ? chunks.map((c, i) => ({
            index: i + 1,
            content: `Datos del Excel (bloque ${i + 1} de ${chunks.length}):\n\n${c}`,
          }))
        : buildChunkItems(chunks, preamble);
    setChunkProgress({ current: 0, total: chunks.length });
    const result = await processChunks(items, chunks.length, chunkSystemOverride);
    setChunkProgress(null);

    if (result.rows.length === 0) {
      setFailedChunkInfo(result.failed.length > 0 ? result.failed : null);
      setError(
        result.failed.length === chunks.length
          ? `Falló la extracción de los ${chunks.length} bloques tras ${MAX_CHUNK_ATTEMPTS} intentos cada uno. Revisá el Excel.`
          : "No se pudo extraer ninguna tarifa."
      );
      return;
    }
    const cleanRows = result.rows
      .map(stripTruncatedField)
      .map((r) =>
        type === "rate" ? applyAdditionalCosts(r, resolved) : r
      );
    // [debug-rate] temp: confirm the cost fields are landing on rows
    console.log(
      "[debug-rate] first 3 rows after applyAdditionalCosts:",
      cleanRows.slice(0, 3)
    );
    let warning: string | null = null;
    if (result.failed.length > 0) {
      const totalCount = chunks.length;
      warning = `Se procesaron ${totalCount - result.failed.length} de ${totalCount} bloques (${cleanRows.length} tarifas). Bloques con error: ${result.failed.map((f) => f.index).join(", ")}.`;
    } else if (result.partial) {
      warning = `Se extrajeron ${cleanRows.length} tarifas. Algún bloque vino truncado — pueden faltar tarifas.`;
    }
    setFailedChunkInfo(result.failed.length > 0 ? result.failed : null);
    // Stash resolved costs so retryFailedChunks can apply them to recovered
    // rows without re-running the upfront resolution call.
    setRetryResolvedCosts(type === "rate" ? resolved : null);
    if (supportsMany) {
      setPreviewRows(cleanRows);
      setPreviewSelected(new Set(cleanRows.map((_, i) => i)));
      setPreviewWarning(warning);
      setRawResponse(null);
    } else {
      onExtracted((cleanRows[0] ?? {}) as Record<string, unknown>);
    }
  };

  const retryFailedChunks = async () => {
    if (!failedChunkInfo || failedChunkInfo.length === 0) return;
    const items = failedChunkInfo;
    setChunkProgress({ current: 0, total: items.length });
    setError(null);
    const result = await processChunks(
      items,
      items.length,
      chunkSystemOverride
    );
    setChunkProgress(null);
    const cleanRows = result.rows
      .map(stripTruncatedField)
      .map((r) =>
        type === "rate" && retryResolvedCosts
          ? applyAdditionalCosts(r, retryResolvedCosts)
          : r
      );
    if (cleanRows.length > 0) {
      // Append rows to the existing preview and pre-select the new ones so
      // they get saved alongside the originals.
      setPreviewRows((prev) => {
        const base = prev ?? [];
        return [...base, ...cleanRows];
      });
      setPreviewSelected((prev) => {
        const next = new Set(prev);
        const startIdx = (previewRows?.length ?? 0);
        for (let i = 0; i < cleanRows.length; i++) next.add(startIdx + i);
        return next;
      });
    }
    setFailedChunkInfo(result.failed.length > 0 ? result.failed : null);
    if (result.failed.length > 0) {
      setPreviewWarning(
        `Algunos bloques siguen fallando tras reintentar: ${result.failed.map((f) => f.index).join(", ")}. Subí el Excel nuevamente para esos rangos si querés más tarifas.`
      );
    } else {
      setPreviewWarning(
        cleanRows.length > 0
          ? `Recuperación exitosa — se agregaron ${cleanRows.length} tarifas más.`
          : null
      );
    }
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      // Excel uploads for rate/ebs go through the chunked pipeline so a single
      // max_tokens cap can't truncate the result. Image/manual modes and the
      // local-* types still use the single-call path.
      const isChunkable =
        mode === "excel" &&
        excelText &&
        (type === "rate" || type === "ebs");
      if (isChunkable) {
        await submitChunked();
        return;
      }

      let content: string | ContentPayload;
      if (mode === "image") {
        if (docxText) {
          content = `Contenido del documento Word:\n\n${docxText}`;
        } else if (imageData) {
          const isPdf = imageData.mediaType === "application/pdf";
          content = [
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
                ? "Extraé los datos del PDF según las instrucciones del system."
                : "Extraé los datos de la imagen según las instrucciones del system.",
            },
          ];
        } else {
          setError("Subí un archivo primero.");
          return;
        }
      } else if (mode === "excel") {
        if (!excelText) {
          setError("Subí un Excel primero.");
          return;
        }
        content = `Datos del Excel:\n\n${excelText}`;
      } else {
        if (!manualText.trim()) {
          setError("Pegá el texto primero.");
          return;
        }
        content = manualText;
      }

      const res = await fetch("/api/billing/extract-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system, content }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `API error ${res.status}`);
      }

      const { text: responseText } = (await res.json()) as { text: string };
      try {
        const parsed = parseExtractedJson(responseText);
        consumeParsed(parsed);
      } catch (parseErr) {
        // Surface the raw response so the user can read what Claude returned and
        // either fix it inline (and retry parse) or fall back to the manual form.
        setRawResponse(responseText);
        setError(
          parseErr instanceof Error
            ? `No pude parsear la respuesta como JSON: ${parseErr.message}`
            : "No pude parsear la respuesta como JSON"
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al extraer datos");
    } finally {
      setLoading(false);
    }
  };

  const retryParse = (text: string) => {
    try {
      const parsed = parseExtractedJson(text);
      setRawResponse(null);
      setError(null);
      consumeParsed(parsed);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Sigue sin parsear: ${err.message}`
          : "Sigue sin parsear"
      );
    }
  };

  const retryParseAggressive = (text: string) => {
    try {
      const parsed = parseExtractedJsonAggressive(text);
      setRawResponse(null);
      setError(null);
      consumeParsed(parsed);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Sigue sin parsear (incluso después de limpieza agresiva): ${err.message}`
          : "Sigue sin parsear"
      );
    }
  };

  const togglePreview = (idx: number) => {
    setPreviewSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const updatePreviewField = (idx: number, field: string, value: unknown) => {
    setPreviewRows((prev) => {
      if (!prev) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const confirmPreview = () => {
    if (!previewRows || !onExtractedMany) return;
    const selected = previewRows.filter((_, i) => previewSelected.has(i));
    if (selected.length === 0) {
      setError("Seleccioná al menos una fila para guardar.");
      return;
    }
    onExtractedMany(selected);
  };

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
          El Excel se está enviando a Claude en bloques de {CHUNK_DATA_ROWS} filas para
          evitar truncamiento. No cierres esta pestaña.
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

  if (previewRows && supportsMany) {
    const Preview = type === "rate" ? RateMultiPreview : MultiResultPreview;
    return (
      <Preview
        rows={previewRows}
        selected={previewSelected}
        onToggle={togglePreview}
        onUpdateField={updatePreviewField}
        onConfirm={confirmPreview}
        onBack={() => {
          setPreviewRows(null);
          setPreviewSelected(new Set());
          setPreviewWarning(null);
          setError(null);
        }}
        onCancel={onCancel}
        error={error}
        warning={previewWarning}
        warningAction={
          failedChunkInfo && failedChunkInfo.length > 0
            ? {
                label: "Reintentar bloques fallidos",
                onClick: retryFailedChunks,
              }
            : undefined
        }
      />
    );
  }

  if (rawResponse !== null) {
    return (
      <RawResponseEditor
        initial={rawResponse}
        onRetry={retryParse}
        onRetryAggressive={retryParseAggressive}
        onBack={() => {
          setRawResponse(null);
          setError(null);
        }}
        onCancel={onCancel}
        error={error}
      />
    );
  }

  if (mode === "choose") {
    return (
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">¿Cómo querés ingresar los datos?</h3>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <IntakeCard
            icon="📷"
            title="Imagen, PDF, Word o correo"
            desc="Subí un screenshot, foto, PDF o Word y Claude extrae los datos"
            onClick={() => setMode("image")}
          />
          <IntakeCard
            icon="📊"
            title="Excel"
            desc="Subí .xlsx, se parsea a texto y Claude extrae los datos"
            onClick={() => setMode("excel")}
          />
          <IntakeCard
            icon="✏️"
            title="Manual"
            desc="Pegá el texto del correo y Claude extrae los datos"
            onClick={() => setMode("manual")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">
          {mode === "image"
            ? "Subir imagen, PDF, Word o screenshot"
            : mode === "excel"
              ? "Subir Excel"
              : "Pegar texto"}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetMode}>
            Cambiar método
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>

      {mode === "image" && (
        <>
          <button
            type="button"
            onClick={() => imageInput.current?.click()}
            className="w-full cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-6 text-sm text-gray-600 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
          >
            {fileName ? (
              <span>{fileName} — clic para cambiar</span>
            ) : (
              <>
                <div className="font-medium">Hacé clic para elegir un archivo</div>
                <div className="text-xs text-gray-500 mt-1">
                  PNG, JPG, PDF, DOCX — screenshot de email, foto de pantalla, documento PDF o Word
                </div>
              </>
            )}
          </button>
          <input
            ref={imageInput}
            type="file"
            accept="image/*,.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImage(file);
            }}
            className="hidden"
          />
        </>
      )}

      {mode === "excel" && (
        <>
          <button
            type="button"
            onClick={() => excelInput.current?.click()}
            className="w-full cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-6 text-sm text-gray-600 hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            {fileName
              ? `Excel: ${fileName} — clic para cambiar`
              : "Hacé clic para elegir un Excel (.xlsx)"}
          </button>
          <input
            ref={excelInput}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleExcel(file);
            }}
            className="hidden"
          />
        </>
      )}

      {mode === "manual" && (
        <textarea
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder="Pegá aquí el texto del correo o la descripción de la tarifa..."
          rows={8}
          className="w-full border border-gray-200 rounded-md p-2 text-sm font-mono"
        />
      )}

      {sizeWarning && (
        <div className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2 mt-3">
          ⚠️ {sizeWarning}
        </div>
      )}

      {error && <div className="text-sm text-red-600 mt-3">{error}</div>}

      <div className="flex justify-end gap-2 mt-4">
        <Button onClick={submit} disabled={loading}>
          {loading ? "Extrayendo con Claude..." : "Extraer con Claude"}
        </Button>
      </div>
    </div>
  );
}

type ContentPayload = Array<
  | { type: "text"; text: string }
  | {
      type: "image" | "document";
      source: { type: "base64"; media_type: string; data: string };
    }
>;

function IntakeCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center gap-2 hover:border-blue-500 hover:bg-blue-50 transition-colors"
    >
      <span className="text-3xl">{icon}</span>
      <span className="font-medium">{title}</span>
      <span className="text-xs text-gray-500 text-center">{desc}</span>
    </button>
  );
}

function strField(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return v === null || v === undefined ? "" : String(v);
}

function numField(row: Record<string, unknown>, key: string): number {
  const v = row[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function MultiResultPreview({
  rows,
  selected,
  onToggle,
  onUpdateField,
  onConfirm,
  onBack,
  onCancel,
  error,
  warning,
  warningAction,
}: {
  rows: Record<string, unknown>[];
  selected: Set<number>;
  onToggle: (idx: number) => void;
  onUpdateField: (idx: number, field: string, value: unknown) => void;
  onConfirm: () => void;
  onBack: () => void;
  onCancel: () => void;
  error: string | null;
  warning?: string | null;
  warningAction?: { label: string; onClick: () => void };
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">
          Resultados extraídos ({rows.length}) — seleccioná y editá lo que quieras guardar
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            Volver
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>

      {warning && (
        <div className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2 mb-3 flex items-start justify-between gap-3">
          <span>⚠️ {warning}</span>
          {warningAction && (
            <button
              type="button"
              onClick={warningAction.onClick}
              className="shrink-0 bg-yellow-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-yellow-700 cursor-pointer"
            >
              {warningAction.label}
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 mb-3">
        Los items marcados se guardarán como nuevos EBS. Podés editar cualquier campo antes de confirmar.
      </p>

      <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
        {rows.map((row, idx) => {
          const isOn = selected.has(idx);
          return (
            <div
              key={idx}
              className={`border rounded-md p-3 ${
                isOn ? "border-blue-300 bg-blue-50/40" : "border-gray-200 bg-gray-50"
              }`}
            >
              <label className="flex items-start gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => onToggle(idx)}
                  className="mt-1"
                />
                <span className="text-sm font-medium">
                  {strField(row, "carrier") || "(sin naviera)"} —{" "}
                  {strField(row, "traffic") || "(sin tráfico)"} —{" "}
                  {strField(row, "tipo").toLowerCase() === "reefer"
                    ? "Reefer"
                    : "Dry"}{" "}
                  — ${numField(row, "amountPerTEU")}/TEU
                </span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <label className="flex flex-col gap-1">
                  Naviera
                  <input
                    type="text"
                    value={strField(row, "carrier")}
                    onChange={(e) => onUpdateField(idx, "carrier", e.target.value)}
                    className="border border-gray-200 rounded p-1.5 h-8 bg-white"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Tráfico
                  <input
                    type="text"
                    value={strField(row, "traffic")}
                    onChange={(e) => onUpdateField(idx, "traffic", e.target.value)}
                    className="border border-gray-200 rounded p-1.5 h-8 bg-white"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Tipo
                  <select
                    value={
                      strField(row, "tipo").toLowerCase() === "reefer"
                        ? "Reefer"
                        : "Dry"
                    }
                    onChange={(e) => onUpdateField(idx, "tipo", e.target.value)}
                    className="border border-gray-200 rounded p-1.5 h-8 bg-white"
                  >
                    <option value="Dry">Dry</option>
                    <option value="Reefer">Reefer</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  USD por TEU
                  <input
                    type="number"
                    value={numField(row, "amountPerTEU")}
                    onChange={(e) =>
                      onUpdateField(idx, "amountPerTEU", Number(e.target.value))
                    }
                    className="border border-gray-200 rounded p-1.5 h-8 bg-white"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Vigente desde
                  <input
                    type="date"
                    value={strField(row, "validFrom")}
                    onChange={(e) => onUpdateField(idx, "validFrom", e.target.value)}
                    className="border border-gray-200 rounded p-1.5 h-8 bg-white"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Vigente hasta
                  <input
                    type="date"
                    value={strField(row, "validTo")}
                    onChange={(e) => onUpdateField(idx, "validTo", e.target.value)}
                    className="border border-gray-200 rounded p-1.5 h-8 bg-white"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Notas
                  <input
                    type="text"
                    value={strField(row, "notes")}
                    onChange={(e) => onUpdateField(idx, "notes", e.target.value)}
                    className="border border-gray-200 rounded p-1.5 h-8 bg-white"
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {error && <div className="text-sm text-red-600 mt-3">{error}</div>}

      <div className="flex justify-end gap-2 mt-4">
        <Button onClick={onConfirm} disabled={selected.size === 0}>
          Guardar {selected.size} de {rows.length}
        </Button>
      </div>
    </div>
  );
}

// Compact table-style preview for rate extraction. Shows the most-identifying
// columns at a glance and reveals the full editable form for a single row when
// the user clicks "Editar". All checkboxes are pre-selected on entry so the
// default action is "save everything Claude found".
function RateMultiPreview({
  rows,
  selected,
  onToggle,
  onUpdateField,
  onConfirm,
  onBack,
  onCancel,
  error,
  warning,
  warningAction,
}: {
  rows: Record<string, unknown>[];
  selected: Set<number>;
  onToggle: (idx: number) => void;
  onUpdateField: (idx: number, field: string, value: unknown) => void;
  onConfirm: () => void;
  onBack: () => void;
  onCancel: () => void;
  error: string | null;
  warning?: string | null;
  warningAction?: { label: string; onClick: () => void };
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const allSelected = rows.length > 0 && rows.every((_, i) => selected.has(i));
  // Only widen the table with the optional cost columns when at least one
  // row has a meaningful value — typical multi-extract has none.
  const showExtra = rows.some(
    (r) =>
      numField(r, "thermalLinerChile20") > 0 ||
      numField(r, "thermalLinerChile40") > 0 ||
      numField(r, "thermalLinerMendoza20") > 0 ||
      numField(r, "thermalLinerMendoza40") > 0 ||
      numField(r, "fcaHaulageMendoza20") > 0 ||
      numField(r, "fcaHaulageMendoza40") > 0 ||
      numField(r, "discountInsulated") > 0 ||
      strField(r, "additionalNotes").trim() !== "" ||
      // Legacy fallbacks: detect older single-thermal rows so the columns
      // still appear after a re-extract migration.
      numField(r, "thermalLiner20") > 0 ||
      numField(r, "thermalLiner40") > 0 ||
      numField(r, "fcaHaulage20") > 0 ||
      numField(r, "fcaHaulage40") > 0
  );
  const toggleAll = () => {
    // Re-emit a toggle for every index whose state needs flipping. Callers
    // already debounce setState updates so a loop is fine here.
    rows.forEach((_, i) => {
      const shouldBeSelected = !allSelected;
      const isSelected = selected.has(i);
      if (shouldBeSelected !== isSelected) onToggle(i);
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">
          Tarifas extraídas ({rows.length}) — seleccioná las que quieras guardar
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            Volver
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Por defecto todas están marcadas. Hacé clic en &quot;Editar&quot; para corregir
        cualquier campo de una fila antes de guardar.
      </p>

      {warning && (
        <div className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2 mb-3 flex items-start justify-between gap-3">
          <span>⚠️ {warning}</span>
          {warningAction && (
            <button
              type="button"
              onClick={warningAction.onClick}
              className="shrink-0 bg-yellow-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-yellow-700 cursor-pointer"
            >
              {warningAction.label}
            </button>
          )}
        </div>
      )}

      <div className="max-h-[60vh] overflow-y-auto border border-gray-200 rounded">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Seleccionar todas"
                />
              </th>
              {[
                "Agente",
                "Carrier",
                "Ruta",
                "Tipo",
                "SF",
                "BL Fee",
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
                "Acciones",
              ].map((h) => (
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
            {rows.map((row, idx) => {
              const isEditing = editingIdx === idx;
              const isSelected = selected.has(idx);
              return (
                <Fragment key={idx}>
                  <tr
                    className={`text-sm ${
                      isSelected ? "" : "opacity-60"
                    }`}
                  >
                    <td className="px-3 py-2 w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle(idx)}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">
                      {strField(row, "agent") || "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {strField(row, "carrier") || "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {strField(row, "route") || "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {strField(row, "tipo") || "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      ${numField(row, "sf")}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      ${numField(row, "blFee")}
                    </td>
                    {showExtra && (
                      <>
                        <td className="px-3 py-2 whitespace-nowrap">
                          $
                          {numField(row, "thermalLinerChile20") ||
                            numField(row, "thermalLiner20")}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          $
                          {numField(row, "thermalLinerChile40") ||
                            numField(row, "thermalLiner40")}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          ${numField(row, "thermalLinerMendoza20")}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          ${numField(row, "thermalLinerMendoza40")}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          $
                          {numField(row, "fcaHaulageMendoza20") ||
                            numField(row, "fcaHaulage20")}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          $
                          {numField(row, "fcaHaulageMendoza40") ||
                            numField(row, "fcaHaulage40")}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {numField(row, "discountInsulated") > 0
                            ? `-$${numField(row, "discountInsulated")}`
                            : "—"}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingIdx(isEditing ? null : idx)}
                      >
                        {isEditing ? "Cerrar" : "Editar"}
                      </Button>
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="bg-blue-50/40">
                      <td colSpan={showExtra ? 15 : 8} className="px-4 py-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <RateField
                            label="Agente"
                            row={row}
                            field="agent"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateField
                            label="Carrier"
                            row={row}
                            field="carrier"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateField
                            label="Ruta"
                            row={row}
                            field="route"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateField
                            label="Tipo"
                            row={row}
                            field="tipo"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateNumField
                            label="SF"
                            row={row}
                            field="sf"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateNumField
                            label="BL Fee"
                            row={row}
                            field="blFee"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateNumField
                            label="AF"
                            row={row}
                            field="af"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateNumField
                            label="AF Max"
                            row={row}
                            field="afMax"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateNumField
                            label="Flexi ARG"
                            row={row}
                            field="flexiArg"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateField
                            label="Vigente desde"
                            row={row}
                            field="validFrom"
                            inputType="date"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateField
                            label="Vigente hasta"
                            row={row}
                            field="validTo"
                            inputType="date"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateField
                            label="Notas"
                            row={row}
                            field="notes"
                            onChange={onUpdateField}
                            idx={idx}
                            colSpan="col-span-2 md:col-span-4"
                          />
                          <RateNumField
                            label="Thermal Chile 20'"
                            row={row}
                            field="thermalLinerChile20"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateNumField
                            label="Thermal Chile 40'"
                            row={row}
                            field="thermalLinerChile40"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateNumField
                            label="Thermal Mza 20'"
                            row={row}
                            field="thermalLinerMendoza20"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateNumField
                            label="Thermal Mza 40'"
                            row={row}
                            field="thermalLinerMendoza40"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateNumField
                            label="Haulage Mza 20'"
                            row={row}
                            field="fcaHaulageMendoza20"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateNumField
                            label="Haulage Mza 40'"
                            row={row}
                            field="fcaHaulageMendoza40"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateNumField
                            label="Desc. Insulado"
                            row={row}
                            field="discountInsulated"
                            onChange={onUpdateField}
                            idx={idx}
                          />
                          <RateField
                            label="Notas adicionales"
                            row={row}
                            field="additionalNotes"
                            onChange={onUpdateField}
                            idx={idx}
                            colSpan="col-span-2 md:col-span-3"
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
      </div>

      {error && <div className="text-sm text-red-600 mt-3">{error}</div>}

      <div className="flex justify-end gap-2 mt-4">
        <Button onClick={onConfirm} disabled={selected.size === 0}>
          Guardar seleccionadas ({selected.size} de {rows.length})
        </Button>
      </div>
    </div>
  );
}

function RateField({
  label,
  row,
  field,
  inputType = "text",
  onChange,
  idx,
  colSpan,
}: {
  label: string;
  row: Record<string, unknown>;
  field: string;
  inputType?: "text" | "date";
  onChange: (idx: number, field: string, value: unknown) => void;
  idx: number;
  colSpan?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${colSpan ?? ""}`}>
      {label}
      <input
        type={inputType}
        value={strField(row, field)}
        onChange={(e) => onChange(idx, field, e.target.value)}
        className="border border-gray-200 rounded p-1.5 h-8 bg-white"
      />
    </label>
  );
}

function RateNumField({
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
        value={numField(row, field)}
        onChange={(e) => onChange(idx, field, Number(e.target.value))}
        className="border border-gray-200 rounded p-1.5 h-8 bg-white"
      />
    </label>
  );
}

function RawResponseEditor({
  initial,
  onRetry,
  onRetryAggressive,
  onBack,
  onCancel,
  error,
}: {
  initial: string;
  onRetry: (text: string) => void;
  onRetryAggressive: (text: string) => void;
  onBack: () => void;
  onCancel: () => void;
  error: string | null;
}) {
  const [text, setText] = useState(initial);
  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">Respuesta cruda de Claude</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            Volver
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar y completar manualmente
          </Button>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-2">
        El JSON devuelto no se pudo parsear. Revisá el texto, corregí lo que falte (por
        ejemplo cerrá un corchete o quitá texto extra) y reintentá. Si preferís, cerrá este
        diálogo y completá el formulario a mano.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={16}
        className="w-full border border-gray-200 rounded-md p-2 text-xs font-mono"
      />
      {error && <div className="text-sm text-red-600 mt-3">{error}</div>}
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={() => onRetry(text)}>
          Reintentar parse
        </Button>
        <Button
          onClick={() => onRetryAggressive(text)}
          title="Quita comentarios, comas finales y cierra brackets/braces incompletos antes de parsear"
        >
          Intentar parsear de nuevo
        </Button>
      </div>
    </div>
  );
}
