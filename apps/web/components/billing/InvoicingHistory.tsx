"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  INVOICE_HISTORY_PREFIX,
  InvoiceHistoryEntry,
  invoiceHistoryKey,
} from "./constants";

function loadUserHistory(userId: string): InvoiceHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(invoiceHistoryKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as InvoiceHistoryEntry[];
  } catch {
    return [];
  }
}

function loadAllHistory(): InvoiceHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const entries: InvoiceHistoryEntry[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(INVOICE_HISTORY_PREFIX)) continue;
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(key) ?? "[]"
      ) as InvoiceHistoryEntry[];
      entries.push(...parsed);
    } catch {
      // ignore malformed entries
    }
  }
  return entries;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("es-CL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function InvoicingHistory({
  currentUserId,
  currentUserName,
  isAdmin,
  refreshToken,
}: {
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
  refreshToken: number;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"me" | "all" | string>("me");
  const [entries, setEntries] = useState<InvoiceHistoryEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (scope === "me") {
      setEntries(loadUserHistory(currentUserId));
    } else if (scope === "all") {
      setEntries(loadAllHistory());
    } else {
      setEntries(loadUserHistory(scope));
    }
  }, [open, scope, currentUserId, refreshToken]);

  const userOptions = useMemo(() => {
    // refreshToken bumps to force recomputation after a new invoice is saved
    void refreshToken;
    if (!isAdmin || !open) return [];
    const all = loadAllHistory();
    const byUser = new Map<string, string>();
    for (const e of all) {
      byUser.set(e.userId, e.userName || e.userId);
    }
    return Array.from(byUser.entries()).map(([id, name]) => ({ id, name }));
  }, [isAdmin, open, refreshToken]);

  const sortedEntries = useMemo(
    () =>
      entries
        .slice()
        .sort((a, b) => b.invoicedAt.localeCompare(a.invoicedAt)),
    [entries]
  );

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
      >
        <span className="font-semibold">
          {open ? "▼" : "▶"} Historial de facturaciones
          {!open && entries.length > 0 && (
            <span className="ml-2 text-sm text-gray-500 font-normal">
              ({entries.length})
            </span>
          )}
        </span>
        {isAdmin && open && (
          <span className="text-xs text-gray-500">Vista admin</span>
        )}
      </button>

      {open && (
        <div className="border-t border-gray-200 p-4">
          {isAdmin && (
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm text-gray-600">Ver historial de:</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="border border-gray-200 rounded-md p-2 h-9 text-sm"
              >
                <option value="me">Yo ({currentUserName})</option>
                <option value="all">Todos los usuarios</option>
                {userOptions
                  .filter((u) => u.id !== currentUserId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {sortedEntries.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">
              No hay facturaciones registradas todavía.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sortedEntries.map((e) => (
                <div
                  key={e.id}
                  className="border border-gray-200 rounded-md"
                >
                  <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {formatDateTime(e.invoicedAt)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {e.blCount} BL{e.blCount === 1 ? "" : "s"} — por{" "}
                        {e.userName || e.userId}
                        {e.filterSummary && (
                          <span className="ml-1">· {e.filterSummary}</span>
                        )}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setExpandedId((id) => (id === e.id ? null : e.id))
                      }
                    >
                      {expandedId === e.id ? "Ocultar BLs" : "Ver BLs"}
                    </Button>
                  </div>
                  {expandedId === e.id && (
                    <div className="border-t border-gray-200 p-3 bg-gray-50 overflow-x-auto">
                      {e.rows.length === 0 ? (
                        <div className="text-xs text-gray-500">
                          BLs: {e.bls.join(", ") || "—"}
                        </div>
                      ) : (
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="text-left text-gray-500">
                              <th className="px-2 py-1">BL</th>
                              <th className="px-2 py-1">Agente</th>
                              <th className="px-2 py-1">Carrier</th>
                              <th className="px-2 py-1">Ruta</th>
                              <th className="px-2 py-1">Tipo</th>
                              <th className="px-2 py-1">BLs</th>
                              <th className="px-2 py-1">Ctrs</th>
                              <th className="px-2 py-1">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {e.rows.map((r, idx) => (
                              <tr key={idx}>
                                <td className="px-2 py-1 font-mono">
                                  {r.blNumber || "—"}
                                </td>
                                <td className="px-2 py-1">{r.agent}</td>
                                <td className="px-2 py-1">{r.carrier}</td>
                                <td className="px-2 py-1">{r.route}</td>
                                <td className="px-2 py-1">{r.tipo}</td>
                                <td className="px-2 py-1">{r.bls}</td>
                                <td className="px-2 py-1">{r.ctrs}</td>
                                <td className="px-2 py-1">
                                  {typeof r.total === "number"
                                    ? `$${r.total.toLocaleString("es-AR")}`
                                    : r.total}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
