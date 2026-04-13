"use client";

import { Input } from "@/components/ui/Input";
import { Dropdown, DropdownOption } from "@/components/ui/Dropdown";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/providers/SessionProvider";
import { Checkbox } from "@/components/ui/Checkbox";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { submitConfirmation, ConfirmationFormData } from "@/lib/confirmations";
import { getUsers, User } from "@/lib/users";

export default function ConfirmationFormV2() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();
  const { session, refreshSession } = useSession();

  // Refresh session if coming from login redirect
  useEffect(() => {
    if (searchParams.get("refresh")) {
      refreshSession();
      window.history.replaceState({}, "", "/confirmations/new");
    }
  }, [searchParams, refreshSession]);

  // Only fetch users once we have a valid session (avoids race condition
  // after login redirect where the layout hasn't re-run getSession yet)
  useEffect(() => {
    if (!session) return;

    const fetchUsers = async () => {
      try {
        const fetchedUsers = await getUsers();
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Error loading users:", error);
        alert("Error al cargar los usuarios");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [session]);

  const clientOptions: DropdownOption[] = users.map((user) => ({
    id: user.id,
    label:
      `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
    value: user.id,
  }));

  const {
    control,
    handleSubmit,
    formState: { errors },
    register,
  } = useForm<ConfirmationFormData>({
    defaultValues: {
      client: "",
      shipper: "",
      importer: "",
      ref: "",
      incoterm: "",
      isInsulated: false,
      isFlexitank: false,
      isIsotank: false,
      isTermografos: false,
      isGateOutLiberado: false,
      temperature: "",
      stacking: "",
      cutoff: "",
    },
  });

  const downloadFile = (
    base64Data: string,
    filename: string,
    contentType: string
  ) => {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: contentType });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const onSubmit = async (data: ConfirmationFormData) => {
    setIsSubmitting(true);
    try {
      const selectedUser = users.find((user) => user.id === data.client);

      if (!selectedUser) {
        throw new Error("Cliente no encontrado");
      }

      const customerName = `${selectedUser.firstName} ${selectedUser.lastName}`;
      const customerPhone = selectedUser.phone || "";

      const formData = new FormData();
      formData.append("customerName", customerName);
      formData.append("customerPhone", customerPhone);
      formData.append("shipper", data.shipper || "");
      formData.append("importer", data.importer || "");
      formData.append("ref", data.ref || "");
      formData.append("incoterm", data.incoterm || "");
      formData.append("isInsulated", data.isInsulated.toString());
      formData.append("isFlexitank", data.isFlexitank.toString());
      formData.append("isIsotank", data.isIsotank.toString());
      formData.append("isTermografos", data.isTermografos.toString());
      formData.append("isGateOutLiberado", data.isGateOutLiberado.toString());
      formData.append("temperature", data.temperature || "");
      formData.append("stacking", data.stacking || "");
      formData.append("cutoff", data.cutoff || "");

      if (data.file && data.file.length > 0) {
        const file = data.file[0];
        if (file) {
          formData.append("file", file);
        }
      }

      const result = await submitConfirmation(formData);

      downloadFile(result.fileData!, result.filename!, result.contentType!);

      alert("Confirmacion enviada exitosamente. El archivo se ha descargado.");
    } catch (error) {
      console.error("Error submitting form:", error);
      alert(
        `Error al enviar la confirmacion: ${error instanceof Error ? error.message : "Error desconocido"}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p>Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-3xl flex flex-col gap-4"
      >
        <h1 className="text-2xl font-bold text-center">Nueva Confirmacion</h1>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Controller
              name="client"
              control={control}
              rules={{ required: "Cliente es requerido" }}
              render={({ field }) => (
                <Dropdown
                  id="client"
                  name="client"
                  label="Cliente"
                  options={clientOptions}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Selecciona un cliente"
                />
              )}
            />
            {errors.client && (
              <p className="text-red-500 text-sm mt-1">
                {errors.client.message}
              </p>
            )}
          </div>

          <div>
            <Input
              type="text"
              id="shipper"
              label="Shipper"
              {...register("shipper")}
            />
          </div>

          <div>
            <Input
              type="text"
              id="importer"
              label="Importer"
              {...register("importer")}
            />
          </div>

          <div>
            <Input type="text" id="ref" label="REF" {...register("ref")} />
          </div>

          <div>
            <Input
              type="text"
              id="incoterm"
              label="Incoterm"
              {...register("incoterm")}
            />
          </div>

          <div>
            <Input
              type="text"
              id="temperature"
              label="Temperatura (T)"
              placeholder="Ej: -18"
              {...register("temperature")}
            />
          </div>

          <div>
            <Input
              type="text"
              id="stacking"
              label="Stacking"
              placeholder="Dejar vacio para 'Por confirmar'"
              {...register("stacking")}
            />
          </div>

          <div>
            <Input
              type="text"
              id="cutoff"
              label="Cutoff"
              placeholder="Dejar vacio para 'Por confirmar'"
              {...register("cutoff")}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Controller
            name="isInsulated"
            control={control}
            render={({ field }) => (
              <Checkbox
                label="Insulado"
                id="insulated"
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            name="isFlexitank"
            control={control}
            render={({ field }) => (
              <Checkbox
                label="Flexitank"
                id="flexitank"
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            name="isIsotank"
            control={control}
            render={({ field }) => (
              <Checkbox
                label="Isotank"
                id="isotank"
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            name="isTermografos"
            control={control}
            render={({ field }) => (
              <Checkbox
                label="Termografos"
                id="termografos"
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            name="isGateOutLiberado"
            control={control}
            render={({ field }) => (
              <Checkbox
                label="Gate Out Liberado"
                id="gateOutLiberado"
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        <div>
          <input
            type="file"
            id="file"
            accept="application/pdf"
            {...register("file", { required: "Archivo es requerido" })}
            className="border border-gray-200 rounded-md p-2 w-full"
          />
          <label htmlFor="file" className="block text-sm font-medium mb-2">
            Subir archivo (PDF)
          </label>
          {errors.file && (
            <p className="text-red-500 text-sm mt-1">{errors.file.message}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full cursor-pointer"
        >
          {isSubmitting ? "Enviando..." : "Solicitar confirmacion"}
        </Button>
      </form>
    </div>
  );
}
