"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteUser } from "@/lib/users";
import { userKeys } from "@/lib/users/query-keys";
import toast from "react-hot-toast";

interface DeleteUserParams {
  userId: number;
  firstName: string | null;
  lastName: string | null;
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId }: DeleteUserParams) => deleteUser(userId),
    onSuccess: (_, variables) => {
      // Invalidate and refetch users query
      queryClient.invalidateQueries({ queryKey: userKeys.list() });

      // Show success toast
      const name =
        `${variables.firstName || ""} ${variables.lastName || ""}`.trim() ||
        "Usuario";
      toast.success(`Usuario '${name}' eliminado exitosamente`);
    },
  });
}
