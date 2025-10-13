"use client";

import { useUsers } from "@/lib/users/useUsers";
import DeleteUserButton from "@/app/users/DeleteUserButton";
import ChangePasswordModal from "@/app/users/ChangePasswordModal";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useState } from "react";

export default function UsersPage() {
  const { data: users, isLoading, isError, error } = useUsers();
  const router = useRouter();
  const [changePasswordUser, setChangePasswordUser] = useState<{
    id: number;
    name: string;
  } | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="text-center py-8 text-gray-500">Loading users...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="text-center py-8 text-red-500">
          Error loading users: {error?.message}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Users</h1>
        <Button onClick={() => router.push("/users/new")}>Crear Usuario</Button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                First Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users?.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.firstName || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.lastName || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.phone || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => router.push(`/users/${user.id}/edit`)}
                      variant="outline"
                      size="sm"
                    >
                      Editar
                    </Button>
                    <Button
                      onClick={() =>
                        setChangePasswordUser({
                          id: user.id,
                          name:
                            `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                            user.email,
                        })
                      }
                      variant="outline"
                      size="sm"
                    >
                      Cambiar Contraseña
                    </Button>
                    <DeleteUserButton
                      userId={user.id}
                      firstName={user.firstName}
                      lastName={user.lastName}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users?.length === 0 && (
          <div className="text-center py-8 text-gray-500">No users found</div>
        )}
      </div>

      {changePasswordUser && (
        <ChangePasswordModal
          userId={changePasswordUser.id}
          userName={changePasswordUser.name}
          isOpen={!!changePasswordUser}
          onClose={() => setChangePasswordUser(null)}
        />
      )}
    </div>
  );
}
