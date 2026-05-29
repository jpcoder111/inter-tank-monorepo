"use server";

import { BACKEND_URL } from "@/lib/constants";
import { getSession, updateTokens } from "@/lib/session";
import { redirect } from "next/navigation";

export interface ConfirmationFormData {
  client: string | number;
  shipper?: string;
  importer?: string;
  ref?: string;
  incoterm?: string;
  isInsulated: boolean;
  isFlexitank: boolean;
  isIsotank: boolean;
  isTermografos: boolean;
  isGateOutLiberado: boolean;
  temperature?: string;
  stacking?: string;
  cutoff?: string;
  file: FileList;
}

async function refreshAccessToken(
  refreshToken: string
): Promise<string | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh: refreshToken }),
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

    const { accessToken, refreshToken: newRefreshToken } = await response.json();

    await updateTokens({ accessToken, refreshToken: newRefreshToken });

    return accessToken;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}

export async function submitConfirmation(formData: FormData) {
  try {
    const session = await getSession();
    if (!session) {
      redirect("/auth/signin");
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.accessToken}`,
    };

    let response = await fetch(`${BACKEND_URL}/confirmation`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (response.status === 401 && session.refreshToken) {
      console.log("Attempting to refresh token...");
      const newAccessToken = await refreshAccessToken(session.refreshToken);

      if (newAccessToken) {
        console.log("Token refreshed successfully, retrying request...");
        headers.Authorization = `Bearer ${newAccessToken}`;

        response = await fetch(`${BACKEND_URL}/confirmation`, {
          method: "POST",
          headers,
          body: formData,
        });
      } else {
        console.log("Token refresh failed, redirecting to login...");
        redirect("/auth/signin");
      }
    }

    if (!response.ok) {
      let body = "";
      try {
        body = await response.text();
      } catch {
        body = "<unable to read response body>";
      }
      throw new Error(
        `Backend ${response.status} ${response.statusText}: ${body}`
      );
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get("content-disposition");
    let filename = "confirmation-response.pdf";

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1] || "confirmation-response.pdf";
      }
    }

    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return {
      success: true,
      fileData: base64,
      filename: filename,
      contentType: blob.type,
    };
  } catch (error) {
    console.error("Error submitting confirmation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
