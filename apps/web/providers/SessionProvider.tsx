"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type SessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  role?: string;
};

type Session = {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
} | null;

type SessionContextType = {
  session: Session;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: Session;
}) {
  const [session, setSession] = useState<Session>(initialSession);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/session", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setSession(data);
        } else {
          console.error("Invalid response format - expected JSON");
          setSession(null);
        }
      } else if (response.status === 401) {
        // Unauthorized - session expired
        setSession(null);
        router.push("/auth/signin");
      } else {
        setSession(null);
      }
    } catch (error) {
      console.error("Error fetching session:", error);
      // Don't set session to null on network errors, keep existing session
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Refresh session when window gains focus
  useEffect(() => {
    const handleFocus = () => {
      refreshSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSession();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshSession]);

  // Listen for custom session update events
  useEffect(() => {
    const handleSessionUpdate = () => {
      refreshSession();
    };

    window.addEventListener("session-updated", handleSessionUpdate);
    return () => {
      window.removeEventListener("session-updated", handleSessionUpdate);
    };
  }, [refreshSession]);

  return (
    <SessionContext.Provider value={{ session, isLoading, refreshSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
