import { api } from "@/lib/api";

export interface FeatureRequest {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  createdBy: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface CreateFeatureRequestData {
  title: string;
  description: string;
}

export async function getFeatureRequests(): Promise<FeatureRequest[]> {
  const response = await api.get<FeatureRequest[]>("/feature-request");
  return response.data;
}

export async function createFeatureRequest(
  data: CreateFeatureRequestData
): Promise<FeatureRequest> {
  const response = await api.post<FeatureRequest>("/feature-request", data);
  return response.data;
}
