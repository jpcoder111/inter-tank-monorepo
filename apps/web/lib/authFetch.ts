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

  if (response.status === 401) {
    if (!session?.refreshToken) {
      throw new Error("No refresh token found");
    }

    const newAccessToken = await refreshToken(session.refreshToken);

    if (!newAccessToken) {
      throw new Error("Failed to refresh token");
    }
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${newAccessToken}`,
    };

    response = await fetch(url, options);
  }

  return response;
};
