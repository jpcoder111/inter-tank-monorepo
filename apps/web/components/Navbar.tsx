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

  // Check if user is admin
  const isAdmin = session?.user?.role === "ADMIN";

  // Determine selected section based on current path
  const getSelectedSection = (path: string): string => {
    if (/^\/auth(\/.*)?$/.test(path)) {
      return "auth";
    }
    // If path matches confirmations* (starts with confirmations)
    if (/^\/confirmations/.test(path)) {
      return "confirmaciones";
    }
    // If path matches users* (starts with users)
    if (/^\/users/.test(path)) {
      return "usuarios";
    }
    // If path matches ai-config
    if (/^\/billing/.test(path)) {
  return "billing";  
    }
    // If path matches feature-requests
    if (/^\/feature-requests/.test(path)) {
      return "feature-requests";
    }
    // If path matches settings
    if (/^\/settings/.test(path)) {
      return "settings";
    }
    // Default to confirmaciones for any other path
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
      {/* Show skeleton or nothing while loading */}
      {!isLoading && isAdmin && (
        <>
          <Section
            icon={<HiUsers />}
            text="Usuarios"
            selected={selectedSection === "usuarios"}
            onClick={() => router.push("/users")}
          />
          <Section
  icon={<HiCalculator />}
  text="Facturación"
  selected={selectedSection === "billing"}
  onClick={() => router.push("/billing")}
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
