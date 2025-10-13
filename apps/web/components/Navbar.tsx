"use client";

import { usePathname, useRouter } from "next/navigation";
import { IoHomeOutline } from "react-icons/io5";
import { GrDocumentVerified } from "react-icons/gr";
import { HiUsers } from "react-icons/hi";
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
    <div className="flex flex-col flex-1 p-4 bg-blue-700 max-w-60 gap-2">
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
      {/* Show skeleton or nothing while loading */}
      {!isLoading && isAdmin && (
        <Section
          icon={<HiUsers />}
          text="Usuarios"
          selected={selectedSection === "usuarios"}
          onClick={() => router.push("/users")}
        />
      )}
    </div>
  );
}
