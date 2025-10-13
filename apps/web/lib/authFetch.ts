import { refreshToken } from "./auth";
import { getSession } from "./session";

export interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

export const authFetch = async (
  url: string | URL,
  options: FetchOptions = {}
) => {
  const session = await getSession();

  if (session) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${session.accessToken}`,
    };
  }

  let response = await fetch(url, options);

  // Only handle 401 Unauthorized (authentication failures)
  if (response.status === 401) {
    // Try to refresh the token if we have a refresh token
    if (session?.refreshToken) {
      console.log("Attempting to refresh token...");
      const newAccessToken = await refreshToken(session.refreshToken);

      if (newAccessToken) {
        console.log("Token refreshed successfully, retrying request...");
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${newAccessToken}`,
        };

        response = await fetch(url, options);
      } else {
        // Token refresh failed, redirect to login
        console.log("Token refresh failed, redirecting to login...");
        if (typeof window !== "undefined") {
          window.location.href = "/auth/signin";
        }
      }
    } else {
      // No refresh token available, redirect to login
      console.log("No refresh token available, redirecting to login...");
      if (typeof window !== "undefined") {
        window.location.href = "/auth/signin";
      }
    }
  }

  return response;
};
