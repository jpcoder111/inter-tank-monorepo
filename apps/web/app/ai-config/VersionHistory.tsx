"use client";

import type { PromptVersion } from "@/lib/ai-config/types";

interface VersionHistoryProps {
  versions: PromptVersion[];
  selectedVersionId: number | null;
  onSelectVersion: (version: PromptVersion) => void;
  isEditMode: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}, ${hh}:${min}`;
}

function getInitials(version: PromptVersion): string {
  const { firstName, lastName } = version.createdBy;
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0]!.toUpperCase();
  return version.createdBy.email[0]!.toUpperCase();
}

function getFullName(version: PromptVersion): string {
  const { firstName, lastName, email } = version.createdBy;
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  return email;
}

function getModelShort(model: string): string {
  if (model.includes("opus-4-6")) return "Opus 4.6";
  if (model.includes("sonnet-4-6")) return "Sonnet 4.6";
  if (model.includes("sonnet-4-5")) return "Sonnet 4.5";
  if (model.includes("haiku-4-5")) return "Haiku 4.5";
  return model;
}

export default function VersionHistory({
  versions,
  selectedVersionId,
  onSelectVersion,
  isEditMode,
}: VersionHistoryProps) {
  if (versions.length === 0) {
    return (
      <div className="text-center py-4 text-gray-400 text-xs">
        Sin versiones
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 overflow-auto">
      {versions.map((version, idx) => {
        const isSelected = selectedVersionId === version.id;
        const isActive = idx === 0;

        return (
          <button
            key={version.id}
            onClick={() => onSelectVersion(version)}
            className={`text-left px-3 py-2 rounded border text-xs transition-colors ${
              isSelected
                ? "border-blue-500 bg-blue-50"
                : "border-transparent hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="font-semibold text-gray-700">
                v{version.version}
              </span>
              {isActive && (
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-px rounded-full leading-tight">
                  activa
                </span>
              )}
              {!isEditMode && isSelected && !isActive && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-px rounded-full leading-tight">
                  comparando
                </span>
              )}
              <span
                className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0 ml-auto"
                title={getFullName(version)}
              >
                {getInitials(version)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1 text-gray-400">
              <span>{getModelShort(version.model)}</span>
              <span>{formatDate(version.createdAt)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
