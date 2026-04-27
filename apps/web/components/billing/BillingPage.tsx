"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/providers/SessionProvider";
import RatesTab from "./RatesTab";
import EbsTab from "./EbsTab";
import LocalChargesTab from "./LocalChargesTab";
import ArgClientsTab from "./ArgClientsTab";
import InvoicingTab from "./InvoicingTab";

type TabKey = "rates" | "ebs" | "local" | "argClients" | "invoicing";

export default function BillingPage() {
  const { session, isLoading } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const tabs = useMemo(
    () =>
      [
        { key: "rates" as const, label: "Tarifas Agentes", adminOnly: true },
        { key: "ebs" as const, label: "Tabla EBS", adminOnly: true },
        { key: "local" as const, label: "Gastos Locales", adminOnly: true },
        { key: "argClients" as const, label: "Clientes ARG", adminOnly: false },
        { key: "invoicing" as const, label: "Facturación", adminOnly: false },
      ].filter((t) => (t.adminOnly ? isAdmin : true)),
    [isAdmin]
  );

  const [active, setActive] = useState<TabKey>("invoicing");

  useEffect(() => {
    if (!tabs.some((t) => t.key === active)) {
      setActive(tabs[0]?.key ?? "invoicing");
    }
  }, [tabs, active]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Facturación</h1>
        <div className="text-center py-8 text-gray-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <h1 className="text-2xl font-bold">Facturación de Fletes Marítimos</h1>

      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              active === t.key
                ? "border-blue-700 text-blue-700"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {active === "rates" && isAdmin && <RatesTab />}
        {active === "ebs" && isAdmin && <EbsTab />}
        {active === "local" && isAdmin && <LocalChargesTab />}
        {active === "argClients" && <ArgClientsTab readOnly={!isAdmin} />}
        {active === "invoicing" && <InvoicingTab />}
      </div>
    </div>
  );
}
