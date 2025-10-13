"use client";

import { useDeleteUser } from "@/lib/users/useDeleteUser";
import toast from "react-hot-toast";

interface DeleteUserButtonProps {
  userId: number;
  firstName: string | null;
  lastName: string | null;
}

export default function DeleteUserButton({
  userId,
  firstName,
  lastName,
}: DeleteUserButtonProps) {
  const { mutate: deleteUser, isPending } = useDeleteUser();

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this user?")) {
      return;
    }

    deleteUser(
      { userId, firstName, lastName },
      {
        onError: (error: Error) => {
          console.error("Failed to delete user:", error);
          toast.error("Error al eliminar usuario. Por favor intente de nuevo.");
        },
      }
    );
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPending ? "Deleting..." : "Delete"}
    </button>
  );
}
