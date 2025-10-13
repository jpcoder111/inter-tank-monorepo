"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createUser, type CreateUserData } from "@/lib/users";
import { userKeys } from "@/lib/users/query-keys";
import toast from "react-hot-toast";

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserData) => createUser(data),
    onSuccess: () => {
      // Invalidate and refetch users query
      queryClient.invalidateQueries({ queryKey: userKeys.list() });

      // Show success toast
      toast.success("Usuario creado exitosamente");
    },
    onError: (error: Error) => {
      // Show error toast
      toast.error(`Error al crear usuario: ${error.message}`);
    },
  });
}
