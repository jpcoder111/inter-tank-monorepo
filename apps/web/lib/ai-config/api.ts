import { api } from "@/lib/api";
import type { PromptVersion, CreatePromptVersionData } from "./types";

export async function getActiveConfig(): Promise<PromptVersion | null> {
  const response = await api.get<PromptVersion>("/ai-config/active");
  return response.data;
}

export async function getAllVersions(): Promise<PromptVersion[]> {
  const response = await api.get<PromptVersion[]>("/ai-config/versions");
  return response.data;
}

export async function createPromptVersion(
  data: CreatePromptVersionData
): Promise<PromptVersion> {
  const response = await api.post<PromptVersion>("/ai-config/versions", data);
  return response.data;
}
