"use client";

import { useRef, useState } from "react";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/Button";

type IntakeType = "rate" | "ebs" | "local_std" | "local_exception";
type Mode = "choose" | "image" | "excel" | "manual";

const RATE_SYSTEM = `Sos un extractor de tarifas de fletes marítimos. El input describe una tarifa (agente logístico, carrier, ruta, tipo de contenedor, costos, vigencia).
Devolvé SOLO un objeto JSON con los siguientes campos. Usá "" para strings faltantes y 0 para números faltantes. No incluyas comentarios, markdown ni texto adicional.

{
  "agent": string,         // nombre del agente (IWS, Van Moer, Asstra, HCL, Scan, CCL, BULLET u otro)
  "carrier": string,       // naviera (OOCL, HAPAG, CMA-CGM, PIL, COSCO, Evergreen, MSC u otra)
  "route": string,         // ruta o puerto de destino
  "tipo": string,          // tipo de contenedor (20', Flexi, 20'-Flexi, 40', 40'HC, 20'RF, 40'RF)
  "sf": number,            // Sea Freight en USD por contenedor
  "blFee": number,         // BL fee en USD por BL
  "af": number,            // Agency fee por contenedor
  "afMax": number,         // AF máximo por BL/operación
  "flexiArg": number,      // cargo adicional Flexi ARG
  "validFrom": string,     // YYYY-MM-DD
  "validTo": string,       // YYYY-MM-DD
  "notes": string          // cualquier observación relevante (incluido all-in, EBS variable, etc.)
}`;

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

Si solo hay un EBS en el input, devolvé un array con un único elemento. NUNCA devuelvas un objeto suelto.`;

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
}`;

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
}`;

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

async function readExcelAsText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    if (!ws) return "";
    const csv = XLSX.utils.sheet_to_csv(ws);
    const cleaned = cleanCsvText(csv);
    return cleaned ? `Hoja: ${name}\n${cleaned}` : "";
  })
    .filter(Boolean)
    .join("\n\n");
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

function parseExtractedJson(
  raw: string
): Record<string, unknown> | Record<string, unknown>[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  // Prefer array form when an array fully contains the brace span — covers cases
  // where Claude wraps multiple objects in []. Fall back to object form otherwise.
  const arrayLooksOuter =
    firstBracket !== -1 &&
    lastBracket !== -1 &&
    (firstBrace === -1 || firstBracket < firstBrace) &&
    (lastBrace === -1 || lastBracket > lastBrace);
  const candidate = arrayLooksOuter
    ? cleaned.slice(firstBracket, lastBracket + 1)
    : firstBrace !== -1 && lastBrace !== -1
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;
  return JSON.parse(candidate) as
    | Record<string, unknown>
    | Record<string, unknown>[];
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
    setRawResponse(null);
  };

  // Multi-row mode is enabled when the parent passed onExtractedMany. EBS uploads
  // can describe several carrier+region rows in one document, so we never want
  // those rolled up into a single form.
  const supportsMany = Boolean(onExtractedMany);

  const consumeParsed = (
    parsed: Record<string, unknown> | Record<string, unknown>[]
  ) => {
    const rows = toRecordArray(parsed);
    if (supportsMany) {
      setPreviewRows(rows);
      setPreviewSelected(new Set(rows.map((_, i) => i)));
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
    setFileName(file.name);
    try {
      const txt = await readExcelAsText(file);
      if (!txt.trim()) {
        setError("El Excel no contiene datos.");
        return;
      }
      setExcelText(txt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al leer Excel");
    }
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
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

  if (previewRows && supportsMany) {
    return (
      <MultiResultPreview
        rows={previewRows}
        selected={previewSelected}
        onToggle={togglePreview}
        onUpdateField={updatePreviewField}
        onConfirm={confirmPreview}
        onBack={() => {
          setPreviewRows(null);
          setPreviewSelected(new Set());
          setError(null);
        }}
        onCancel={onCancel}
        error={error}
      />
    );
  }

  if (rawResponse !== null) {
    return (
      <RawResponseEditor
        initial={rawResponse}
        onRetry={retryParse}
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
}: {
  rows: Record<string, unknown>[];
  selected: Set<number>;
  onToggle: (idx: number) => void;
  onUpdateField: (idx: number, field: string, value: unknown) => void;
  onConfirm: () => void;
  onBack: () => void;
  onCancel: () => void;
  error: string | null;
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

function RawResponseEditor({
  initial,
  onRetry,
  onBack,
  onCancel,
  error,
}: {
  initial: string;
  onRetry: (text: string) => void;
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
        <Button onClick={() => onRetry(text)}>Reintentar parse</Button>
      </div>
    </div>
  );
}
