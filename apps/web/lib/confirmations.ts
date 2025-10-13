"use server";

import { BACKEND_URL } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { refreshToken } from "@/lib/auth";
import { redirect } from "next/navigation";

export interface ConfirmationFormData {
  client: string | number;
  shipper?: string;
  importer?: string;
  ref?: string;
  incoterm?: string;
  isInsulated: boolean;
  isFlexitank: boolean;
  isTermografos: boolean;
  file: FileList;
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

    let response = await fetch(`${BACKEND_URL!}/confirmation`, {
      method: "POST",
      headers,
      body: formData,
    });

    // Handle 401 by attempting token refresh
    if (response.status === 401 && session.refreshToken) {
      console.log("Attempting to refresh token...");
      const newAccessToken = await refreshToken(session.refreshToken);

      if (newAccessToken) {
        console.log("Token refreshed successfully, retrying request...");
        headers.Authorization = `Bearer ${newAccessToken}`;

        response = await fetch(`${BACKEND_URL!}/confirmation`, {
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
      throw new Error(`Error: ${response.status} ${response.statusText}`);
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
