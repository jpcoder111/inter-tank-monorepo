"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useLocalStore } from "./useLocalStore";
import {
  COMERCIALES,
  COMERCIAL_COLORS,
  ComercialName,
  ENTITIES_SEED,
  ENTITIES_STORAGE_KEY,
  ENTITY_TYPE_COLORS,
  Entity,
  EntityStatus,
  EntityType,
  RATES_STORAGE_KEY,
  Rate,
  SEED_RATES,
  deriveQuarterFromDates,
  formatDateCl,
} from "./constants";

// Inline-editable text cell. Click to edit, blur or Enter to commit, Esc
// to cancel. Supports a "required" flag that rolls back to the previous
// value when the user clears the field — used for the Name column where
// an empty value would orphan the entity.
function InlineText({
  value,
  onChange,
  required,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="text-left w-full hover:bg-gray-50 rounded px-1 py-0.5 cursor-text"
      >
        {value || (
          <span className="text-gray-400">{placeholder ?? "—"}</span>
        )}
      </button>
    );
  }
  return (
    <input
      type="text"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        if (required && !trimmed) {
          toast.error("El nombre no puede estar vacío");
          setEditing(false);
          return;
        }
        if (trimmed !== value) onChange(trimmed);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className="border border-gray-300 rounded px-1 py-0.5 text-sm w-full"
    />
  );
}

// Compact comercial chip used inside select cells. Renders the full
// comercial label with the per-comercial colour pair so the row stays
// scannable at a glance. Note: the actual <select> itself receives the
// inline style; this component is exported for the rest of the billing
// UI (RatesTab cards, NewRateFlow modals, pending dropdown).
export function ComercialBadge({
  comercial,
  className,
}: {
  comercial: ComercialName;
  className?: string;
}) {
  const c = COMERCIAL_COLORS[comercial];
  return (
    <span
      style={{ backgroundColor: c.bg, color: c.text }}
      className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${className ?? ""}`}
    >
      {comercial}
    </span>
  );
}

export function TypeBadge({
  type,
  className,
}: {
  type: EntityType;
  className?: string;
}) {
  const c = ENTITY_TYPE_COLORS[type];
  return (
    <span
      style={{ backgroundColor: c.bg, color: c.text }}
      className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${className ?? ""}`}
    >
      {type}
    </span>
  );
}

export default function EntitiesTab() {
  const {
    items: entities,
    add,
    update,
    remove,
    hydrated,
  } = useLocalStore<Entity>(ENTITIES_STORAGE_KEY, ENTITIES_SEED);
  const { items: rates } = useLocalStore<Rate>(
    RATES_STORAGE_KEY,
    SEED_RATES
  );

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | EntityType>("all");
  const [comercialFilter, setComercialFilter] = useState<
    "all" | ComercialName
  >("all");
  const [statusFilter, setStatusFilter] = useState<"all" | EntityStatus>(
    "active"
  );
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return entities.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (comercialFilter !== "all" && e.comercial !== comercialFilter)
        return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      return true;
    });
  }, [entities, search, typeFilter, comercialFilter, statusFilter]);

  // Last-Q-loaded lookup: only meaningful for type=Agente; clients don't
  // load rates. Computed once per (entities, rates) tuple.
  const lastQByEntityId = useMemo(() => {
    const map = new Map<string, { label: string; date: string | null }>();
    for (const e of entities) {
      if (e.type !== "Agente") continue;
      const lower = e.name.trim().toLowerCase();
      const matches = rates.filter(
        (r) => r.agent.trim().toLowerCase() === lower
      );
      if (matches.length === 0) {
        map.set(e.id, { label: "Sin tarifas", date: null });
        continue;
      }
      const sorted = matches
        .slice()
        .sort((a, b) =>
          (b.validTo ?? "").localeCompare(a.validTo ?? "")
        );
      const last = sorted[0]!;
      map.set(e.id, {
        label: deriveQuarterFromDates(last.validFrom, last.validTo),
        date: (last.validTo ?? "").trim() || null,
      });
    }
    return map;
  }, [entities, rates]);

  const updateEntity = (id: string, patch: Partial<Entity>) => {
    update(id, { ...patch, updated_at: new Date().toISOString() });
  };

  const total = entities.length;
  const visibleAgentCount = filtered.filter((e) => e.type === "Agente").length;
  const visibleClientCount = filtered.filter(
    (e) => e.type === "Cliente"
  ).length;

  if (!hydrated) {
    return (
      <div className="text-gray-500 py-8 text-center">
        Cargando catálogo...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-md px-4 py-3 text-sm flex items-start gap-2">
        <span aria-hidden="true">ℹ️</span>
        <span>
          Catálogo de Agentes y Clientes con su comercial asignado. Las
          tarifas en <strong>Tarifas Agentes</strong> validan contra este
          catálogo al guardar — si el agente tipeado no aparece acá, el
          flujo te pide confirmarlo o crearlo.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-md p-2 h-10 min-w-48"
        />
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as "all" | EntityType)
          }
          className="border border-gray-200 rounded-md p-2 h-10 bg-white"
        >
          <option value="all">Todos los tipos</option>
          <option value="Agente">Agente</option>
          <option value="Cliente">Cliente</option>
        </select>
        <select
          value={comercialFilter}
          onChange={(e) =>
            setComercialFilter(e.target.value as "all" | ComercialName)
          }
          className="border border-gray-200 rounded-md p-2 h-10 bg-white"
        >
          <option value="all">Todos los comerciales</option>
          {COMERCIALES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "all" | EntityStatus)
          }
          className="border border-gray-200 rounded-md p-2 h-10 bg-white"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        <div className="flex-1" />
        <span className="text-xs text-gray-500">
          {filtered.length} de {total} · {visibleAgentCount} Agentes ·{" "}
          {visibleClientCount} Clientes
        </span>
        <Button onClick={() => setShowAdd(true)}>+ Agregar entidad</Button>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {[
                "Nombre",
                "Tipo",
                "Comercial",
                "Email",
                "Phone",
                "Status",
                "Último Q",
                "Acciones",
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
            {filtered.map((e) => {
              const last = lastQByEntityId.get(e.id);
              const isInactive = e.status === "inactive";
              return (
                <tr
                  key={e.id}
                  className={`text-sm ${isInactive ? "opacity-60" : ""}`}
                >
                  <td className="px-4 py-2 whitespace-nowrap font-medium">
                    <InlineText
                      value={e.name}
                      onChange={(v) => updateEntity(e.id, { name: v })}
                      required
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <select
                      value={e.type}
                      onChange={(ev) =>
                        updateEntity(e.id, {
                          type: ev.target.value as EntityType,
                        })
                      }
                      style={{
                        backgroundColor: ENTITY_TYPE_COLORS[e.type].bg,
                        color: ENTITY_TYPE_COLORS[e.type].text,
                      }}
                      className="px-2 py-0.5 rounded text-xs font-medium border-0 cursor-pointer"
                    >
                      <option value="Agente">Agente</option>
                      <option value="Cliente">Cliente</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <select
                      value={e.comercial}
                      onChange={(ev) =>
                        updateEntity(e.id, {
                          comercial: ev.target.value as ComercialName,
                        })
                      }
                      style={{
                        backgroundColor: COMERCIAL_COLORS[e.comercial].bg,
                        color: COMERCIAL_COLORS[e.comercial].text,
                      }}
                      className="px-2 py-0.5 rounded text-xs font-medium border-0 cursor-pointer"
                    >
                      {COMERCIALES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-xs">
                    <InlineText
                      value={e.contact_email ?? ""}
                      onChange={(v) =>
                        updateEntity(e.id, { contact_email: v })
                      }
                      placeholder="—"
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-xs">
                    <InlineText
                      value={e.contact_phone ?? ""}
                      onChange={(v) =>
                        updateEntity(e.id, { contact_phone: v })
                      }
                      placeholder="—"
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <select
                      value={e.status}
                      onChange={(ev) =>
                        updateEntity(e.id, {
                          status: ev.target.value as EntityStatus,
                        })
                      }
                      className="border border-gray-200 rounded p-1 h-7 text-xs bg-white"
                    >
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700">
                    {e.type === "Cliente" ? (
                      "—"
                    ) : last?.date ? (
                      <span title={`Hasta ${formatDateCl(last.date)}`}>
                        {last.label}
                      </span>
                    ) : (
                      <span className="text-gray-400">Sin tarifas</span>
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteId(e.id)}
                      className="text-red-700 hover:bg-red-50"
                    >
                      Eliminar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            Sin entidades para los filtros aplicados.
          </div>
        )}
      </div>

      {showAdd && (
        <AddEntityModal
          onAdd={(entity) => {
            add(entity);
            setShowAdd(false);
            toast.success(`Entidad agregada: ${entity.name}`);
          }}
          onClose={() => setShowAdd(false)}
          existingNames={new Set(
            entities.map((e) => e.name.trim().toLowerCase())
          )}
        />
      )}
      {deleteId !== null && (() => {
        const target = entities.find((e) => e.id === deleteId);
        if (!target) return null;
        return (
          <DeleteEntityModal
            entity={target}
            onConfirm={() => {
              remove(deleteId);
              setDeleteId(null);
              toast.success(`Entidad eliminada: ${target.name}`);
            }}
            onCancel={() => setDeleteId(null)}
          />
        );
      })()}
    </div>
  );
}

function AddEntityModal({
  onAdd,
  onClose,
  existingNames,
}: {
  onAdd: (entity: Entity) => void;
  onClose: () => void;
  existingNames: Set<string>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<EntityType>("Agente");
  const [comercial, setComercial] = useState<ComercialName>("No determinado");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const trimmed = name.trim();
  const isDuplicate =
    !!trimmed && existingNames.has(trimmed.toLowerCase());
  const canSubmit = !!trimmed && !isDuplicate;
  const submit = () => {
    if (!canSubmit) return;
    const now = new Date().toISOString();
    const slug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    onAdd({
      id: `entity-${Date.now()}-${slug || "new"}-${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      name: trimmed,
      type,
      comercial,
      status: "active",
      contact_email: email.trim() || undefined,
      contact_phone: phone.trim() || undefined,
      created_at: now,
      updated_at: now,
    });
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-5 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="font-semibold text-base">Agregar entidad</h4>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Nombre *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Yamato Logistics"
            className="border border-gray-200 rounded-md p-2 h-10"
          />
          {isDuplicate && (
            <span className="text-xs text-red-600">
              Ya existe una entidad con ese nombre.
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Tipo *</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EntityType)}
            className="border border-gray-200 rounded-md p-2 h-10 bg-white"
          >
            <option value="Agente">Agente</option>
            <option value="Cliente">Cliente</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Comercial *</span>
          <select
            value={comercial}
            onChange={(e) => setComercial(e.target.value as ComercialName)}
            className="border border-gray-200 rounded-md p-2 h-10 bg-white"
          >
            {COMERCIALES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-gray-200 rounded-md p-2 h-10"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="border border-gray-200 rounded-md p-2 h-10"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            Agregar
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeleteEntityModal({
  entity,
  onConfirm,
  onCancel,
}: {
  entity: Entity;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-5 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="font-semibold text-base">
          Eliminar entidad &quot;{entity.name}&quot;
        </h4>
        <p className="text-sm text-gray-700">
          La entidad desaparece del catálogo. Las tarifas existentes con
          ese agente <strong>NO se borran</strong> del listado de Tarifas
          Agentes — siguen apareciendo. Si en el futuro cargás una tarifa
          con ese nombre, el cross-check te va a tratar como entidad
          nueva.
        </p>
        <p className="text-sm text-gray-500">
          Tip: si lo querés ocultar sin perder la asignación de comercial,
          marcalo como <strong>Inactivo</strong> en lugar de eliminar.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  );
}
