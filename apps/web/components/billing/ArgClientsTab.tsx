"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useLocalStore } from "./useLocalStore";
import { useBulkSelection } from "./useBulkSelection";
import BulkActionsBar from "./BulkActionsBar";
import {
  ARG_CLIENTS_STORAGE_KEY,
  ArgClient,
  ArgClientTipo,
  SEED_ARG_CLIENTS,
  findSimilarClient,
  uid,
} from "./constants";

const emptyDraft: Omit<ArgClient, "id"> = {
  name: "",
  tipo: "Bodega",
  alternativeNames: "",
  notes: "",
};

function Chips({ value }: { value: string }) {
  if (!value.trim()) return <span className="text-gray-400">—</span>;
  const parts = value
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return <span className="text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p, i) => (
        <span
          key={i}
          className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 border border-gray-200 text-gray-700"
        >
          {p}
        </span>
      ))}
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: ArgClientTipo }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
        tipo === "Mostero"
          ? "bg-purple-50 text-purple-800 border-purple-200"
          : "bg-amber-50 text-amber-800 border-amber-200"
      }`}
    >
      {tipo}
    </span>
  );
}

export default function ArgClientsTab({
  readOnly = false,
}: {
  // When true, hides every editing affordance (new/edit/delete/bulk). The
  // tab itself stays visible so non-admins can browse the catalog.
  readOnly?: boolean;
}) {
  const { items: rawItems, add, update, remove, removeMany, hydrated } =
    useLocalStore<ArgClient>(ARG_CLIENTS_STORAGE_KEY, SEED_ARG_CLIENTS);

  // Coerce legacy records (before `tipo` existed) to "Bodega" so the table
  // and form can rely on the field being present.
  const items = useMemo(
    () =>
      rawItems.map((c) => ({ ...c, tipo: (c.tipo ?? "Bodega") as ArgClientTipo })),
    [rawItems]
  );

  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<"" | ArgClientTipo>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<ArgClient, "id">>(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  // When findSimilarClient finds near-matches for a new candidate, we hold
  // the candidate + matches here and render a modal so the user can decide
  // per-row whether to merge as alternative or create a new client.
  const [pendingSimilar, setPendingSimilar] = useState<{
    candidate: Omit<ArgClient, "id">;
    matches: ArgClient[];
    selectedParentId: string | null; // null = create new
  } | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((c) => {
      if (tipoFilter && c.tipo !== tipoFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.alternativeNames.toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q)
      );
    });
  }, [items, search, tipoFilter]);

  const visibleIds = useMemo(() => filtered.map((c) => c.id), [filtered]);
  const { selected, toggleOne, toggleAllVisible, clear, allVisibleSelected } =
    useBulkSelection(visibleIds);

  const handleBulkDelete = () => {
    const ids = Array.from(selected);
    removeMany(ids);
    clear();
    toast.success(
      `${ids.length} cliente${ids.length === 1 ? "" : "s"} eliminado${ids.length === 1 ? "" : "s"}`
    );
  };

  const openNew = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (client: ArgClient) => {
    const { id: _id, ...rest } = client;
    void _id;
    setDraft(rest);
    setEditingId(client.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!draft.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    // Edits skip the dedup pipeline — the user is intentionally modifying
    // an existing record. Only new additions get checked.
    if (editingId) {
      update(editingId, draft);
      setShowForm(false);
      setEditingId(null);
      return;
    }
    const { exactMatch, similarMatches } = findSimilarClient(draft.name, items);
    if (exactMatch) {
      toast(
        `"${draft.name.trim()}" ya existe como ${exactMatch.name === draft.name.trim() ? "cliente" : `marca de "${exactMatch.name}"`} — se descartó.`,
        { icon: "ℹ️", duration: 5000 }
      );
      setShowForm(false);
      return;
    }
    if (similarMatches.length > 0) {
      setPendingSimilar({
        candidate: draft,
        matches: similarMatches,
        selectedParentId: similarMatches[0]!.id,
      });
      return;
    }
    add({ ...draft, id: uid("arg") });
    setShowForm(false);
    setEditingId(null);
  };

  const confirmPendingSimilar = () => {
    if (!pendingSimilar) return;
    const { candidate, selectedParentId, matches } = pendingSimilar;
    const newName = candidate.name.trim();
    if (selectedParentId === null) {
      add({ ...candidate, id: uid("arg") });
      toast.success(`"${newName}" creado como cliente nuevo`);
    } else {
      const parent = matches.find((m) => m.id === selectedParentId);
      if (!parent) {
        // Defensive: if the selected match disappeared between render and
        // confirm, just create a new client.
        add({ ...candidate, id: uid("arg") });
        toast.success(`"${newName}" creado como cliente nuevo`);
      } else {
        const existing = parent.alternativeNames.trim();
        const merged = existing ? `${existing}, ${newName}` : newName;
        update(parent.id, { alternativeNames: merged });
        toast.success(
          `"${newName}" agregado como marca alternativa de "${parent.name}"`
        );
      }
    }
    setPendingSimilar(null);
    setShowForm(false);
    setEditingId(null);
  };

  const cancel = () => {
    setShowForm(false);
    setEditingId(null);
  };

  if (!hydrated) {
    return (
      <div className="text-gray-500 py-8 text-center">Cargando clientes...</div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-md p-2 h-10 min-w-48"
        />
        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value as "" | ArgClientTipo)}
          className="border border-gray-200 rounded-md p-2 h-10 bg-white"
        >
          <option value="">Todos los tipos</option>
          <option value="Bodega">Bodegas</option>
          <option value="Mostero">Mosteros</option>
        </select>
        <span className="text-xs text-gray-500">
          {filtered.length} de {items.length} clientes
        </span>
        <div className="flex-1" />
        {!readOnly && <Button onClick={openNew}>Nuevo cliente</Button>}
      </div>

      {readOnly && (
        <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          Vista de solo lectura. Para editar la lista, pedile a un administrador.
        </div>
      )}

      {!readOnly && showForm && (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <h3 className="font-semibold mb-3">
            {editingId ? "Editar cliente" : "Nuevo cliente"}
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Los clientes argentinos reciben los costos de Mendoza (Thermal Liner
            Mendoza, FCA Haulage Mendoza) en lugar de los de Chile cuando se
            facturan sus BLs. Las marcas alternativas amplían el match — si el
            shipper del BL coincide con cualquiera de ellas, se aplica el cliente.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Nombre
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="border border-gray-200 rounded-md p-2 h-10"
                placeholder="Bodegas Fabre"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Tipo
              <select
                value={draft.tipo}
                onChange={(e) =>
                  setDraft({ ...draft, tipo: e.target.value as ArgClientTipo })
                }
                className="border border-gray-200 rounded-md p-2 h-10 bg-white"
              >
                <option value="Bodega">Bodega</option>
                <option value="Mostero">Mostero</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              Marcas / nombres alternativos
              <input
                type="text"
                value={draft.alternativeNames}
                onChange={(e) =>
                  setDraft({ ...draft, alternativeNames: e.target.value })
                }
                className="border border-gray-200 rounded-md p-2 h-10"
                placeholder="Trapiche, Finca Las Moras"
              />
              <span className="text-xs text-gray-500">
                Separadas por coma. El match con el shipper es case-insensitive
                y bidireccional.
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              Notas
              <input
                type="text"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                className="border border-gray-200 rounded-md p-2 h-10"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={cancel}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Guardar</Button>
          </div>
        </div>
      )}

      {!readOnly && (
        <BulkActionsBar
          count={selected.size}
          onDelete={handleBulkDelete}
          onClear={clear}
          itemLabel="cliente"
        />
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {!readOnly && (
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="Seleccionar todos"
                  />
                </th>
              )}
              {[
                "Cliente",
                "Tipo",
                "Marcas alternativas",
                "Notas",
                ...(readOnly ? [] : ["Acciones"]),
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.map((c) => (
              <tr key={c.id} className="text-sm">
                {!readOnly && (
                  <td className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleOne(c.id)}
                      aria-label={`Seleccionar ${c.name}`}
                    />
                  </td>
                )}
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  {c.name}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <TipoBadge tipo={c.tipo} />
                </td>
                <td className="px-4 py-3 max-w-md">
                  <Chips value={c.alternativeNames} />
                </td>
                <td className="px-4 py-3 max-w-xs truncate text-gray-600">
                  {c.notes || "—"}
                </td>
                {!readOnly && (
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(c)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`¿Eliminar cliente "${c.name}"?`))
                            remove(c.id);
                        }}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500">No hay clientes</div>
        )}
      </div>

      {pendingSimilar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold mb-2">Cliente similar encontrado</h3>
            <p className="text-sm text-gray-700 mb-4">
              El nombre <strong>&quot;{pendingSimilar.candidate.name}&quot;</strong> se
              parece a clientes ya existentes. ¿Cómo querés guardarlo? Por
              defecto se agrega como marca alternativa.
            </p>
            <div className="flex flex-col gap-2">
              {pendingSimilar.matches.map((m) => {
                const isChecked = pendingSimilar.selectedParentId === m.id;
                return (
                  <label
                    key={m.id}
                    className={`flex items-start gap-3 p-3 border rounded cursor-pointer ${
                      isChecked
                        ? "border-blue-300 bg-blue-50/40"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="arg-similar-parent"
                      checked={isChecked}
                      onChange={() =>
                        setPendingSimilar({
                          ...pendingSimilar,
                          selectedParentId: m.id,
                        })
                      }
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        Agregar como marca alternativa de &quot;{m.name}&quot;
                      </div>
                      {m.alternativeNames.trim() && (
                        <div className="text-xs text-gray-500 mt-0.5 truncate">
                          Marcas actuales: {m.alternativeNames}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
              <label
                className={`flex items-start gap-3 p-3 border rounded cursor-pointer ${
                  pendingSimilar.selectedParentId === null
                    ? "border-blue-300 bg-blue-50/40"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="arg-similar-parent"
                  checked={pendingSimilar.selectedParentId === null}
                  onChange={() =>
                    setPendingSimilar({
                      ...pendingSimilar,
                      selectedParentId: null,
                    })
                  }
                  className="mt-1"
                />
                <div className="text-sm font-medium">
                  Crear cliente nuevo de todas formas
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button
                variant="outline"
                onClick={() => setPendingSimilar(null)}
              >
                Cancelar
              </Button>
              <Button onClick={confirmPendingSimilar}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
