"use client";

import { usePathname, useRouter } from "next/navigation";
import { IoHomeOutline } from "react-icons/io5";
import { GrDocumentVerified } from "react-icons/gr";
import Section from "@/components/navbar/Section";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  // Determine selected section based on current path
  const getSelectedSection = (path: string): string => {
    if (/^\/auth(\/.*)?$/.test(path)) {
      return "auth";
    }
    // If path matches confirmations* (starts with confirmations)
    if (/^\/confirmations/.test(path)) {
      return "confirmaciones";
    }
    // If path is "/" or empty, select home
    if (path === "/" || path === "") {
      return "inicio";
    }
    // Default to home for any other path
    return "inicio";
  };

  const selectedSection = getSelectedSection(pathname);

  return selectedSection === "auth" ? (
    <></>
  ) : (
    <div className="flex flex-col flex-1 p-4 bg-blue-600 max-w-60 gap-2">
      <Section
        icon={<IoHomeOutline />}
        text="Inicio"
        selected={selectedSection === "inicio"}
        onClick={() => router.push("/")}
      />
      <Section
        icon={<GrDocumentVerified />}
        text="Confirmaciones"
        selected={selectedSection === "confirmaciones"}
        onClick={() => router.push("/confirmations/new")}
      />
    </div>
  );
}
