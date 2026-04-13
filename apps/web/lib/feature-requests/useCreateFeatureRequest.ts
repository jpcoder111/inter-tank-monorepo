"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFeatureRequest, type CreateFeatureRequestData } from "@/lib/feature-requests";
import { featureRequestKeys } from "@/lib/feature-requests/query-keys";
import toast from "react-hot-toast";

export function useCreateFeatureRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFeatureRequestData) => createFeatureRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: featureRequestKeys.list() });
      toast.success("Feature request creado exitosamente");
    },
    onError: (error: Error) => {
      toast.error(`Error al crear feature request: ${error.message}`);
    },
  });
}
