"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateUser, type UpdateUserData } from "@/lib/users";
import { userKeys } from "@/lib/users/query-keys";
import toast from "react-hot-toast";

export function useUpdateUser(userId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateUserData) => updateUser(userId, data),
    onSuccess: () => {
      // Invalidate and refetch users query
      queryClient.invalidateQueries({ queryKey: userKeys.list() });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) });

      // Show success toast
      toast.success("Usuario actualizado exitosamente");
    },
    onError: (error: Error) => {
      // Show error toast
      toast.error(`Error al actualizar usuario: ${error.message}`);
    },
  });
}
