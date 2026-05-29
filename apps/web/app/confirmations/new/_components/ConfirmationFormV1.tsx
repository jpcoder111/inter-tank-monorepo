"use client";

import { Input } from "@/components/ui/Input";
import { Dropdown, DropdownOption } from "@/components/ui/Dropdown";
import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { submitConfirmation } from "@/lib/confirmations";
import { getUsers, User } from "@/lib/users";

interface V1FormData {
  client: string | number;
  shipper?: string;
  importer?: string;
  ref?: string;
  incoterm?: string;
  isInsulated: boolean;
  isFlexitank: boolean;
  isTermografos: boolean;
  file: FileList;
}

export default function ConfirmationFormV1() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
  }, []);

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
  } = useForm<V1FormData>({
    defaultValues: {
      client: "",
      shipper: "",
      importer: "",
      ref: "",
      incoterm: "",
      isInsulated: false,
      isFlexitank: false,
      isTermografos: false,
    },
  });

  const downloadFile = (
    base64Data: string,
    filename: string,
    contentType: string
  ) => {
    if (!base64Data) {
      throw new Error("No se recibió el archivo del servidor");
    }
    const sanitized = base64Data
      .replace(/^data:[^;]+;base64,/, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .replace(/\s+/g, "");
    const binaryString = atob(sanitized);
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

  const onSubmit = async (data: V1FormData) => {
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
      formData.append("isTermografos", data.isTermografos.toString());

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
        className="bg-white border border-gray-200 rounded-xl p-6 w-140 flex flex-col gap-4"
      >
        <h1 className="text-2xl font-bold text-center">Nueva Confirmacion</h1>
        <div className="flex flex-col gap-4">
          <div>
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
          </div>

          <div>
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
          </div>

          <div>
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
