"use client";

import { useState, useEffect, useCallback } from "react";

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

export function useSession() {
  const [session, setSession] = useState<Session>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch("/api/session", {
        cache: "no-store", // Prevent caching to always get fresh data
      });
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setSession(data);
        } else {
          console.error("Invalid response format - expected JSON");
        }
      } else {
        // If session is not found, set to null
        setSession(null);
      }
    } catch (error) {
      console.error("Error fetching session:", error);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();

    // Refetch session when window gains focus (e.g., after login redirect)
    const handleFocus = () => {
      fetchSession();
    };

    // Refetch session when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchSession();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchSession]);

  return { session, isLoading, refetch: fetchSession };
}
