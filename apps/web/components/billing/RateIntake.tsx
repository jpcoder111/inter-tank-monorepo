"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/Button";

type IntakeType = "rate" | "ebs";
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
El EBS se expresa SIEMPRE por TEU (20' = 1 TEU, 40' = 2 TEU). Si el input da el valor por container de 40', dividilo por 2 para obtener el valor por TEU.
Devolvé SOLO un objeto JSON con los siguientes campos. Usá "" para strings faltantes y 0 para números faltantes. No incluyas comentarios, markdown ni texto adicional.

{
  "carrier": string,       // naviera (OOCL, HAPAG, CMA-CGM, etc.)
  "traffic": string,       // tráfico o ruta (ej: "Chile - Norte de Europa", "Chile - Grangemouth")
  "amountPerTEU": number,  // monto en USD por TEU
  "validFrom": string,     // YYYY-MM-DD
  "validTo": string,       // YYYY-MM-DD
  "notes": string          // cualquier observación (unidad original si fue /ctr, exclusiones, etc.)
}`;

function readAsBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] ?? "";
      resolve({ base64, mediaType: file.type || "image/png" });
    };
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

async function readExcelAsText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    if (!ws) return "";
    return `Hoja: ${name}\n${XLSX.utils.sheet_to_csv(ws)}`;
  })
    .filter(Boolean)
    .join("\n\n");
}

function parseExtractedJson(raw: string): Record<string, unknown> {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const candidate =
    firstBrace !== -1 && lastBrace !== -1
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;
  return JSON.parse(candidate) as Record<string, unknown>;
}

export default function RateIntake({
  type,
  onExtracted,
  onCancel,
}: {
  type: IntakeType;
  onExtracted: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<Mode>("choose");
  const [manualText, setManualText] = useState("");
  const [fileName, setFileName] = useState("");
  const [imageData, setImageData] = useState<
    { base64: string; mediaType: string } | null
  >(null);
  const [excelText, setExcelText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const excelInput = useRef<HTMLInputElement>(null);

  const system = type === "rate" ? RATE_SYSTEM : EBS_SYSTEM;

  const resetMode = () => {
    setMode("choose");
    setManualText("");
    setFileName("");
    setImageData(null);
    setExcelText("");
    setError(null);
  };

  const handleImage = async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      const data = await readAsBase64(file);
      setImageData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al leer imagen");
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
        if (!imageData) {
          setError("Subí una imagen primero.");
          return;
        }
        content = [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: imageData.mediaType,
              data: imageData.base64,
            },
          },
          {
            type: "text",
            text: "Extraé los datos de la imagen según las instrucciones del system.",
          },
        ];
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
      const parsed = parseExtractedJson(responseText);
      onExtracted(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al extraer datos");
    } finally {
      setLoading(false);
    }
  };

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
            title="Imagen o correo"
            desc="Subí un screenshot o foto y Claude extrae los datos"
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
            ? "Subir imagen o screenshot"
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
            className="w-full cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-6 text-sm text-gray-600 hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            {fileName
              ? `Imagen: ${fileName} — clic para cambiar`
              : "Hacé clic para elegir una imagen (PNG, JPG)"}
          </button>
          <input
            ref={imageInput}
            type="file"
            accept="image/*"
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
      type: "image";
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
