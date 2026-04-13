"use client";

import { setAuthProvider } from "@/lib/api";
import { BACKEND_URL } from "@/lib/constants";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// Refresh tokens 10 minutes before expiration (for 15-minute access tokens)
const TOKEN_REFRESH_INTERVAL = 10 * 60 * 1000;

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
  getAccessToken: (forceRefresh?: boolean) => Promise<string | null>;
  logout: () => Promise<void>;
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

  // Keep track of the latest session in a ref for async access.
  // Use initialSession as fallback so API calls during the first render
  // cycle (before the sync effect below fires) already have a token.
  const sessionRef = useRef<Session>(session);
  sessionRef.current = session ?? initialSession;

  // Sync server-provided session to client state on login redirect.
  // After login, the server action sets the cookie and redirects. The layout
  // re-renders server-side with the new cookie, but useState's initial value
  // is stale (null from the pre-login render). This syncs the new tokens.
  useLayoutEffect(() => {
    if (initialSession?.accessToken && !session?.accessToken) {
      setSession(initialSession);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSession?.accessToken]);

  // Refresh the session from server
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
          // Keep existing session on invalid response format
        }
      } else if (response.status === 401) {
        setSession(null);
        router.push("/auth/signin");
      } else {
        // Keep existing session on server errors (e.g., 500 during dev hot-reload)
        console.error("Session fetch failed with status:", response.status);
      }
    } catch (error) {
      console.error("Error fetching session:", error);
      // Don't set session to null on network errors, keep existing session
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Refresh tokens from the backend
  const refreshTokens = useCallback(async (): Promise<{
    accessToken: string;
    refreshToken: string;
  } | null> => {
    const currentSession = sessionRef.current;
    if (!currentSession?.refreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh: currentSession.refreshToken }),
      });

      if (!response.ok) {
        console.error("Failed to refresh token:", response.status);
        return null;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Invalid response format - expected JSON");
        return null;
      }

      const { accessToken, refreshToken } = await response.json();

      // Update session cookie via API route
      const updateResponse = await fetch("/api/auth/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessToken, refreshToken }),
      });

      if (!updateResponse.ok) {
        console.error("Failed to update session cookie");
        return null;
      }

      // Update local session state
      setSession((prev) =>
        prev
          ? {
              ...prev,
              accessToken,
              refreshToken,
            }
          : null
      );

      return { accessToken, refreshToken };
    } catch (error) {
      console.error("Error refreshing tokens:", error);
      return null;
    }
  }, []);

  // Get access token (like Firebase's getIdToken)
  const getAccessToken = useCallback(
    async (forceRefresh = false): Promise<string | null> => {
      const currentSession = sessionRef.current;
      if (!currentSession) {
        return null;
      }

      if (forceRefresh) {
        const result = await refreshTokens();
        return result?.accessToken ?? null;
      }

      return currentSession.accessToken;
    },
    [refreshTokens]
  );

  // Logout
  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      });
    } catch (error) {
      console.error("Error during logout:", error);
    }

    setSession(null);
    router.push("/auth/signin");
  }, [router]);

  // Register auth provider with API client.
  // useLayoutEffect ensures this runs BEFORE any child useEffect (like API calls),
  // preventing requests from firing without an auth token.
  useLayoutEffect(() => {
    setAuthProvider({
      getAccessToken,
      onAuthError: () => {
        // Don't auto-logout on auth errors — keep the session alive.
        // The user can manually sign out if needed.
        console.error("Auth error: token refresh failed");
      },
    });
  }, [getAccessToken]);

  // Proactive token refresh interval
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      refreshTokens().catch(console.error);
    }, TOKEN_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [session, refreshTokens]);

  // Event-driven session validation
  useEffect(() => {
    const checkAuthStatus = async () => {
      if (!sessionRef.current) return;

      try {
        const response = await fetch("/api/session", {
          credentials: "include",
        });

        // Only log out on explicit 401 (session expired/invalid)
        // Ignore server errors (500, etc.) to stay logged in during dev hot-reloads
        if (response.status === 401) {
          setSession(null);
          router.push("/auth/signin");
        }
      } catch (error) {
        // Network error — keep session alive
        console.error("Error checking auth status:", error);
      }
    };

    // Check when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden && sessionRef.current) {
        checkAuthStatus();
      }
    };

    // Check when user focuses on window
    const handleFocus = () => {
      if (sessionRef.current) {
        checkAuthStatus();
      }
    };

    // Check when user comes back online
    const handleOnline = () => {
      if (sessionRef.current) {
        checkAuthStatus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
    };
  }, [router]);

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
    <SessionContext.Provider
      value={{ session, isLoading, refreshSession, getAccessToken, logout }}
    >
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
