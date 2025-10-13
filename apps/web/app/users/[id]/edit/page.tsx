"use client";

import { Input } from "@/components/ui/Input";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { useUpdateUser } from "@/lib/users/useUpdateUser";
import { useUser } from "@/lib/users/useUser";
import type { UpdateUserData } from "@/lib/users";
import { use, useEffect } from "react";

export default function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const userId = parseInt(id);
  const { data: user, isLoading, isError } = useUser(userId);
  const updateUserMutation = useUpdateUser(userId);

  const {
    handleSubmit,
    formState: { errors },
    register,
    reset,
  } = useForm<UpdateUserData>({
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
    },
  });

  // Update form when user data is loaded
  useEffect(() => {
    if (user) {
      reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: user.phone || "",
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: UpdateUserData) => {
    updateUserMutation.mutate(data, {
      onSuccess: () => {
        router.push("/users");
      },
    });
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center py-8 text-gray-500">
          Cargando usuario...
        </div>
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center py-8 text-red-500">
          Error al cargar usuario
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white border border-gray-200 rounded-xl p-6 w-140 flex flex-col gap-4"
      >
        <h1 className="text-2xl font-bold text-center">Editar Usuario</h1>
        <div className="flex flex-col gap-4">
          <div>
            <Input
              type="text"
              id="firstName"
              label="Nombre"
              {...register("firstName", {
                required: "Nombre es requerido",
              })}
            />
            {errors.firstName && (
              <p className="text-red-500 text-sm mt-1">
                {errors.firstName.message}
              </p>
            )}
          </div>

          <div>
            <Input
              type="text"
              id="lastName"
              label="Apellido"
              {...register("lastName", {
                required: "Apellido es requerido",
              })}
            />
            {errors.lastName && (
              <p className="text-red-500 text-sm mt-1">
                {errors.lastName.message}
              </p>
            )}
          </div>

          <div>
            <Input
              type="tel"
              id="phone"
              label="Teléfono"
              {...register("phone", {
                required: "Teléfono es requerido",
              })}
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-1">
                {errors.phone.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => router.push("/users")}
            variant="outline"
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={updateUserMutation.isPending}
            className="flex-1 cursor-pointer"
          >
            {updateUserMutation.isPending
              ? "Actualizando..."
              : "Actualizar Usuario"}
          </Button>
        </div>
      </form>
    </div>
  );
}
