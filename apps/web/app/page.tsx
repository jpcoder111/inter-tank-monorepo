"use client";

import { useSession } from "@/providers/SessionProvider";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function Home() {
  const { session, refreshSession } = useSession();
  const searchParams = useSearchParams();

  // Refresh session if coming from login redirect
  useEffect(() => {
    if (searchParams.get("refresh")) {
      refreshSession();
      // Clean up URL
      window.history.replaceState({}, "", "/");
    }
  }, [searchParams, refreshSession]);

  return (
    <main className="flex flex-1 justify-center items-center">
      <h1 className="text-2xl font-bold">
        Bienvenid@ a Inter Tank, {session?.user?.firstName}
      </h1>
    </main>
  );
}
