"use server";

import { BACKEND_URL } from "@/lib/constants";

export interface ConfirmationFormData {
  client: string | number;
  shipper: string;
  importer: string;
  ref: string;
  incoterm: string;
  isInsulated: boolean;
  file: FileList;
}

export async function submitConfirmation(formData: FormData) {
  try {
    // Submit to API
    const response = await fetch(`${BACKEND_URL!}/confirmation`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    // Get the response blob and filename
    const blob = await response.blob();
    const contentDisposition = response.headers.get("content-disposition");
    let filename = "confirmation-response.pdf";

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1] || "confirmation-response.pdf";
      }
    }

    // Convert blob to base64 for client-side handling
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
