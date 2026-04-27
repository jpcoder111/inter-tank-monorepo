"use client";

// Sticky bar that appears above a table when one or more rows are selected.
// Renders the count and a destructive "Eliminar seleccionadas" action that
// confirms before invoking the parent's bulk-delete handler.
export default function BulkActionsBar({
  count,
  onDelete,
  onClear,
  itemLabel = "fila",
  message,
}: {
  count: number;
  onDelete: () => void;
  onClear: () => void;
  itemLabel?: string;
  // Optional override for the count display. Used by callers that want to
  // include extra context (e.g., "5 tarifas de IWS seleccionadas").
  message?: string;
}) {
  if (count === 0) return null;
  const plural = count === 1 ? itemLabel : `${itemLabel}s`;
  const confirmAndDelete = () => {
    if (confirm(`¿Eliminar ${count} ${plural}?`)) onDelete();
  };
  const displayMessage =
    message ?? `${count} ${plural} seleccionada${count === 1 ? "" : "s"}`;
  return (
    <div className="sticky top-0 z-10 bg-blue-50 border border-blue-200 rounded-md px-4 py-2 flex items-center justify-between shadow-sm">
      <span className="text-sm font-medium text-blue-900">{displayMessage}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className="text-sm text-blue-700 hover:underline cursor-pointer"
        >
          Limpiar selección
        </button>
        <button
          type="button"
          onClick={confirmAndDelete}
          className="bg-red-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-red-700 cursor-pointer"
        >
          Eliminar seleccionadas
        </button>
      </div>
    </div>
  );
}
