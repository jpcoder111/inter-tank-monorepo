"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useCreateFeatureRequest } from "@/lib/feature-requests/useCreateFeatureRequest";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { CreateFeatureRequestData } from "@/lib/feature-requests";

export default function NewFeatureRequestPage() {
  const router = useRouter();
  const { mutate: create, isPending } = useCreateFeatureRequest();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateFeatureRequestData>();

  const onSubmit = (data: CreateFeatureRequestData) => {
    create(data, {
      onSuccess: () => {
        router.push("/feature-requests");
      },
    });
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <h1 className="text-2xl font-bold">Nuevo Feature Request</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4 bg-white rounded-lg shadow p-6"
      >
        <div className="flex flex-col gap-1">
          <Input
            id="title"
            label="Titulo"
            {...register("title", { required: "El titulo es requerido" })}
          />
          {errors.title && (
            <p className="text-red-500 text-sm">{errors.title.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Descripcion
          </label>
          <textarea
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[200px] resize-y"
            {...register("description", {
              required: "La descripcion es requerida",
            })}
          />
          {errors.description && (
            <p className="text-red-500 text-sm">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-40"
            onClick={() => router.push("/feature-requests")}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending} className="w-40">
            {isPending ? "Creando..." : "Crear"}
          </Button>
        </div>
      </form>
    </div>
  );
}
