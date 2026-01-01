"use server";

import { redirect } from "next/navigation";
import { BACKEND_URL } from "./constants";
import { getSession, updateTokens } from "./session";

async function serverFetchWithAuth(url: string, options: RequestInit = {}) {
  const session = await getSession();
  if (!session) {
    redirect("/auth/signin");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
    Authorization: `Bearer ${session.accessToken}`,
  };

  let response = await fetch(url, { ...options, headers });

  // Handle 401 by attempting token refresh
  if (response.status === 401 && session.refreshToken) {
    const refreshResponse = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: session.refreshToken }),
    });

    if (refreshResponse.ok) {
      const { accessToken, refreshToken } = await refreshResponse.json();
      await updateTokens({ accessToken, refreshToken });
      headers.Authorization = `Bearer ${accessToken}`;
      response = await fetch(url, { ...options, headers });
    } else {
      redirect("/auth/signin");
    }
  }

  return response;
}

export const getProfile = async () => {
  const response = await serverFetchWithAuth(`${BACKEND_URL}/auth/protected`);

  if (!response.ok) {
    throw new Error(`Failed to fetch profile: ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Invalid response format - expected JSON");
  }

  const result = await response.json();
  return result;
};
