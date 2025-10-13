"use server";

import { authFetch } from "./authFetch";
import { BACKEND_URL } from "./constants";

export const getProfile = async () => {
  const response = await authFetch(`${BACKEND_URL}/auth/protected`);

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
