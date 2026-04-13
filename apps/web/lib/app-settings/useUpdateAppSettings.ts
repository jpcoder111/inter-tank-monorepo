"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateAppSettings } from "./api";
import { appSettingsKeys } from "./query-keys";
import type { AppSettings } from "./types";
import toast from "react-hot-toast";

export function useUpdateAppSettings() {
  const queryClient = useQueryClient();

  return useMutation<
    AppSettings,
    Error,
    Partial<Pick<AppSettings, "useNewConfirmationForm">>
  >({
    mutationFn: updateAppSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appSettingsKeys.all });
      toast.success("Configuración actualizada");
    },
    onError: () => {
      toast.error("Error al actualizar la configuración");
    },
  });
}
