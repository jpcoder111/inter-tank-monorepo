"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { useActiveConfig } from "@/lib/ai-config/useActiveConfig";
import { usePromptVersions } from "@/lib/ai-config/usePromptVersions";
import { useCreatePromptVersion } from "@/lib/ai-config/useCreatePromptVersion";
import type { PromptVersion } from "@/lib/ai-config/types";
import VersionHistory from "./VersionHistory";
import PromptDiff from "./PromptDiff";

const MODEL_OPTIONS = [
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", cost: "$1 / $5" },
  { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", cost: "$3 / $15" },
  { value: "claude-sonnet-4-6-20250627", label: "Claude Sonnet 4.6", cost: "$3 / $15" },
  { value: "claude-opus-4-6-20250627", label: "Claude Opus 4.6", cost: "$15 / $75" },
];

function getModelLabel(value: string): string {
  return MODEL_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function computeDiffStats(oldText: string, newText: string) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  const oldFreq = new Map<string, number>();
  for (const line of oldLines) oldFreq.set(line, (oldFreq.get(line) ?? 0) + 1);

  const newFreq = new Map<string, number>();
  for (const line of newLines) newFreq.set(line, (newFreq.get(line) ?? 0) + 1);

  let linesAdded = 0;
  let linesRemoved = 0;
  let charsAdded = 0;
  let charsRemoved = 0;

  for (const [line, count] of newFreq) {
    const diff = count - (oldFreq.get(line) ?? 0);
    if (diff > 0) {
      linesAdded += diff;
      charsAdded += diff * line.length;
    }
  }

  for (const [line, count] of oldFreq) {
    const diff = count - (newFreq.get(line) ?? 0);
    if (diff > 0) {
      linesRemoved += diff;
      charsRemoved += diff * line.length;
    }
  }

  return { linesAdded, linesRemoved, charsAdded, charsRemoved };
}

interface FormData {
  model: string;
  prompt: string;
}

export default function AiConfigPage() {
  const { data: activeConfig, isLoading: isLoadingActive } = useActiveConfig();
  const { data: versions = [], isLoading: isLoadingVersions } =
    usePromptVersions();
  const createVersion = useCreatePromptVersion();

  // null = edit mode, PromptVersion = comparing that version against active
  const [comparingVersion, setComparingVersion] =
    useState<PromptVersion | null>(null);
  // version the user tried to navigate to while having unsaved changes
  const [pendingVersion, setPendingVersion] = useState<PromptVersion | null>(null);

  const { control, register, handleSubmit, reset, watch } = useForm<FormData>({
    defaultValues: {
      model: "claude-sonnet-4-5-20250929",
      prompt: "",
    },
  });

  const currentModel = watch("model");
  const currentPrompt = watch("prompt");

  const hasChanges =
    activeConfig != null &&
    (currentModel !== activeConfig.model ||
      currentPrompt !== activeConfig.prompt);

  const diffStats = useMemo(() => {
    if (!activeConfig || !hasChanges) return null;
    return computeDiffStats(activeConfig.prompt, currentPrompt);
  }, [activeConfig, hasChanges, currentPrompt]);

  const isEditMode = comparingVersion === null;

  useEffect(() => {
    if (activeConfig) {
      reset({ model: activeConfig.model, prompt: activeConfig.prompt });
    }
  }, [activeConfig, reset]);

  const onSubmit = (data: FormData) => {
    createVersion.mutate(data);
  };

  const handleVersionClick = (version: PromptVersion) => {
    // Clicking the active version always goes back to edit
    const isActive = versions.length > 0 && version.id === versions[0]!.id;
    if (isActive) {
      setComparingVersion(null);
      setPendingVersion(null);
      if (activeConfig) {
        reset({ model: activeConfig.model, prompt: activeConfig.prompt });
      }
      return;
    }

    // Clicking an older version: block if dirty
    if (isEditMode && hasChanges) {
      setPendingVersion(version);
      return;
    }

    // Switch to compare mode
    setPendingVersion(null);
    setComparingVersion(version);
  };

  const handleDiscard = () => {
    if (activeConfig) {
      reset({ model: activeConfig.model, prompt: activeConfig.prompt });
    }
  };

  const handleModalDiscard = () => {
    const target = pendingVersion;
    if (activeConfig) {
      reset({ model: activeConfig.model, prompt: activeConfig.prompt });
    }
    setPendingVersion(null);
    if (target) setComparingVersion(target);
  };

  const handleModalSave = () => {
    const target = pendingVersion;
    handleSubmit((data) => {
      createVersion.mutate(data, {
        onSuccess: () => {
          setPendingVersion(null);
          if (target) setComparingVersion(target);
        },
      });
    })();
  };

  const handleBackToEdit = () => {
    setComparingVersion(null);
    if (activeConfig) {
      reset({ model: activeConfig.model, prompt: activeConfig.prompt });
    }
  };

  if (isLoadingActive || isLoadingVersions) {
    return (
      <div className="flex flex-col h-full">
        <h1 className="text-2xl font-bold mb-4">Configuración IA</h1>
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Cargando...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Configuración IA</h1>
          {!isEditMode && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
              Comparando con v{comparingVersion.version}
            </span>
          )}
        </div>

        {!isEditMode && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                createVersion.mutate(
                  { model: comparingVersion.model, prompt: comparingVersion.prompt },
                  { onSuccess: () => setComparingVersion(null) },
                );
              }}
              disabled={createVersion.isPending}
            >
              {createVersion.isPending ? "Restaurando..." : `Restaurar v${comparingVersion.version}`}
            </Button>
            <Button variant="outline" size="sm" onClick={handleBackToEdit}>
              Volver a editar
            </Button>
          </div>
        )}
      </div>

      {/* Unsaved changes modal */}
      {pendingVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Cambios sin guardar</h2>
            <p className="text-sm text-gray-600 mb-3">
              Guarda o descarta tus cambios antes de comparar versiones.
            </p>
            {diffStats && (diffStats.linesAdded > 0 || diffStats.linesRemoved > 0) && (
              <div className="flex items-center gap-3 text-sm mb-5 px-3 py-2 bg-gray-50 rounded-md">
                {diffStats.linesAdded > 0 && (
                  <span className="text-green-600 font-medium">+{diffStats.linesAdded} {diffStats.linesAdded === 1 ? "linea" : "lineas"}</span>
                )}
                {diffStats.linesRemoved > 0 && (
                  <span className="text-red-500 font-medium">-{diffStats.linesRemoved} {diffStats.linesRemoved === 1 ? "linea" : "lineas"}</span>
                )}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleModalDiscard}>
                Descartar
              </Button>
              <Button
                size="sm"
                onClick={handleModalSave}
                disabled={createVersion.isPending}
              >
                {createVersion.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Main pane - unified card */}
        {isEditMode ? (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex-1 flex flex-col min-h-0 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
          >
            <div className="flex items-center gap-3 shrink-0 px-5 pt-5 pb-2">
              <Label htmlFor="model" className="shrink-0">Modelo</Label>
              <Controller
                name="model"
                control={control}
                render={({ field }) => (
                  <div className="relative inline-block cursor-pointer">
                    <div className="border border-gray-200 rounded-md px-2 py-1.5 text-sm pr-7 pointer-events-none flex items-center gap-1 hover:border-gray-300">
                      {getModelLabel(field.value)}
                      <svg className="w-3.5 h-3.5 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                    <select
                      id="model"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    >
                      {MODEL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label} — {opt.cost}
                        </option>
                      ))}
n                    </select>
                  </div>
                )}
              />
            </div>

            <div className="flex flex-col flex-1 min-h-0 px-5">
              <Label htmlFor="prompt" className="mb-1">System Prompt</Label>
              <textarea
                id="prompt"
                {...register("prompt", { required: true })}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-md p-3 font-mono text-xs resize-none overflow-y-scroll focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ingresa el system prompt..."
              />
              <div className="flex justify-between items-start py-2">
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] tabular-nums text-gray-400">
                <span>{currentPrompt.length.toLocaleString()} caracteres</span>
                {diffStats && (
                  <>
                    <span className="text-gray-300">|</span>
                    {diffStats.charsAdded > 0 && (
                      <span className="text-green-600">+{diffStats.charsAdded.toLocaleString()}</span>
                    )}
                    {diffStats.charsRemoved > 0 && (
                      <span className="text-red-500">-{diffStats.charsRemoved.toLocaleString()}</span>
                    )}
                  </>
                )}
              </div>
              <div className={`flex items-center justify-end gap-2 shrink-0 px-5 py-2 ${hasChanges ? "bg-amber-50" : ""}`}>
                {hasChanges && (
                  <Button type="button" variant="outline" size="sm" onClick={handleDiscard}>
                    Descartar
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={!hasChanges || createVersion.isPending}
                >
                  {createVersion.isPending
                    ? "Guardando..."
                    : "Guardar Nueva Versión"}
                </Button>
              </div>
              </div>
            </div>

          </form>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 gap-3 bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <div className="flex flex-col gap-2">
              <Label>Modelo</Label>
              {comparingVersion!.model === activeConfig!.model ? (
                <span className="text-sm text-gray-700">{getModelLabel(activeConfig!.model)}</span>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded line-through">
                    {getModelLabel(comparingVersion!.model)}
                  </span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                    {getModelLabel(activeConfig!.model)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1 flex-1 min-h-0">
              <Label>System Prompt</Label>
              <PromptDiff
                oldText={comparingVersion!.prompt}
                newText={activeConfig!.prompt}
              />
            </div>
          </div>
        )}

        {/* Right sidebar - Version History */}
        <div className="w-52 shrink-0 flex flex-col min-h-0">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 shrink-0">
            Versiones
          </h2>
          <div className="flex-1 overflow-auto">
            <VersionHistory
              versions={versions}
              selectedVersionId={
                isEditMode
                  ? (versions[0]?.id ?? null)
                  : (comparingVersion?.id ?? null)
              }
              onSelectVersion={handleVersionClick}
              isEditMode={isEditMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
