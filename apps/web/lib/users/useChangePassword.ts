"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { changePassword, type ChangePasswordData } from "@/lib/users";
import { userKeys } from "@/lib/users/query-keys";
import toast from "react-hot-toast";

export function useChangePassword(userId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ChangePasswordData) => changePassword(userId, data),
    onSuccess: () => {
      // Invalidate user queries
      queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) });

      // Show success toast
      toast.success("Contraseña actualizada exitosamente");
    },
    onError: (error: Error) => {
      // Show error toast
      toast.error(`Error al cambiar contraseña: ${error.message}`);
    },
  });
}
