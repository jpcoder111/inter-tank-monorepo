"use client";

import { useAppSettings } from "@/lib/app-settings/useAppSettings";
import { useUpdateAppSettings } from "@/lib/app-settings/useUpdateAppSettings";

export default function SettingsPage() {
  const { data: settings, isLoading } = useAppSettings();
  const { mutate: updateSettings, isPending } = useUpdateAppSettings();

  const checked = settings?.useNewConfirmationForm ?? false;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p>Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="h-full p-8">
      <h1 className="text-2xl font-bold mb-6">Configuración</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-xl">
        <h2 className="text-lg font-semibold mb-4">Confirmaciones</h2>

        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="font-medium">
              Usar nuevo formulario de confirmaciones
            </span>
            <p className="text-sm text-gray-500 mt-0.5">
              Activa la versión v2 del formulario con campos adicionales
              (temperatura, stacking, cutoff, isotank, gate out liberado) y
              layout mejorado.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={isPending}
            onClick={() =>
              updateSettings({ useNewConfirmationForm: !checked })
            }
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
              checked ? "bg-blue-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
                checked ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
