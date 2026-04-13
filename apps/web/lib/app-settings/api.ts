import { api } from "@/lib/api";
import type { AppSettings } from "./types";

export async function getAppSettings(): Promise<AppSettings> {
  const response = await api.get<AppSettings>("/app-settings");
  return response.data;
}

export async function updateAppSettings(
  data: Partial<Pick<AppSettings, "useNewConfirmationForm">>
): Promise<AppSettings> {
  const response = await api.patch<AppSettings>("/app-settings", data);
  return response.data;
}
