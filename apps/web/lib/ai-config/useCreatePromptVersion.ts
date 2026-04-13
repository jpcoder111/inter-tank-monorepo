"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPromptVersion } from "./api";
import { aiConfigKeys } from "./query-keys";
import type { CreatePromptVersionData } from "./types";
import toast from "react-hot-toast";

export function useCreatePromptVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePromptVersionData) => createPromptVersion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiConfigKeys.active() });
      queryClient.invalidateQueries({ queryKey: aiConfigKeys.versions() });
      toast.success("Configuracion guardada exitosamente");
    },
    onError: (error: Error) => {
      toast.error(`Error al guardar configuracion: ${error.message}`);
    },
  });
}
