import { refreshToken } from "./auth";
import { getSession, deleteSession } from "./session";
import { redirect } from "next/navigation";

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
    // Try to refresh the token
    if (!session?.refreshToken) {
      // No refresh token - this is a genuine auth failure
      await deleteSession();
      redirect("/auth/signin");
    }

    try {
      const newAccessToken = await refreshToken(session.refreshToken);

      if (!newAccessToken) {
        // Failed to refresh - genuine auth failure
        await deleteSession();
        redirect("/auth/signin");
      }

      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${newAccessToken}`,
      };

      response = await fetch(url, options);

      // If still 401 after refresh, it's a genuine auth failure
      if (response.status === 401) {
        await deleteSession();
        redirect("/auth/signin");
      }
    } catch (error) {
      // Token refresh failed - genuine auth failure
      await deleteSession();
      redirect("/auth/signin");
    }
  }

  // For all other errors (CORS, network, 404, 500, etc.), just return the response
  // The calling code can handle these errors without logging out the user
  return response;
};
