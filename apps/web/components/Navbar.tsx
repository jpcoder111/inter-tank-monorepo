"use client";

import { usePathname, useRouter } from "next/navigation";
import { IoSettingsOutline } from "react-icons/io5";
import { GrDocumentVerified } from "react-icons/gr";
import { HiUsers, HiLightBulb, HiCalculator } from "react-icons/hi";
import Section from "@/components/navbar/Section";
import { useSession } from "@/providers/SessionProvider";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, isLoading } = useSession();

  const isAdmin = session?.user?.role === "ADMIN";

  const getSelectedSection = (path: string): string => {
    if (/^\/auth(\/.*)?$/.test(path)) return "auth";
    if (/^\/confirmations/.test(path)) return "confirmaciones";
    if (/^\/billing/.test(path)) return "billing";
    if (/^\/users/.test(path)) return "usuarios";
    if (/^\/ai-config/.test(path)) return "ai-config";
    if (/^\/feature-requests/.test(path)) return "feature-requests";
    if (/^\/settings/.test(path)) return "settings";
    return "confirmaciones";
  };

  const selectedSection = getSelectedSection(pathname);

  return selectedSection === "auth" ? (
    <></>
  ) : (
    <div className="flex flex-col flex-1 p-4 bg-blue-700 max-w-60 gap-2">
      <Section
        icon={<GrDocumentVerified />}
        text="Confirmaciones"
        selected={selectedSection === "confirmaciones"}
        onClick={() => router.push("/confirmations/new")}
      />
      <Section
        icon={<HiCalculator />}
        text="Facturación"
        selected={selectedSection === "billing"}
        onClick={() => router.push("/billing")}
      />
      {!isLoading && isAdmin && (
        <>
          <Section
            icon={<HiUsers />}
            text="Usuarios"
            selected={selectedSection === "usuarios"}
            onClick={() => router.push("/users")}
          />
          <Section
            icon={<IoSettingsOutline />}
            text="Configuración IA"
            selected={selectedSection === "ai-config"}
            onClick={() => router.push("/ai-config")}
          />
          <Section
            icon={<HiLightBulb />}
            text="Feature Requests"
            selected={selectedSection === "feature-requests"}
            onClick={() => router.push("/feature-requests")}
          />
          <Section
            icon={<IoSettingsOutline />}
            text="Configuración"
            selected={selectedSection === "settings"}
            onClick={() => router.push("/settings")}
          />
        </>
      )}
    </div>
  );
}
