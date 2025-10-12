"use client";

import { Input } from "@/components/ui/Input";
import { Dropdown, DropdownOption } from "@/components/ui/Dropdown";
import { useState } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { submitConfirmation, ConfirmationFormData } from "@/lib/confirmations";

export default function NewConfirmationPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hardcodedClients = [
    {
      id: 1,
      name: "Alan Quezada",
      phone: "+569 7516 4214",
    },
    {
      id: 2,
      name: "Trinidad Cofre",
      phone: "+56 9 6435 8913",
    },
    {
      id: 3,
      name: "Cesar Varela",
      phone: "+56 9 3207 7575",
    },
    {
      id: 4,
      name: "Omar Mendez",
      phone: "+56 9 7430 8360",
    },
    {
      id: 5,
      name: "Constanza Toro",
      phone: "+56 9 7922 6733",
    },
    {
      id: 6,
      name: "Michael Campos",
      phone: "+56 9 22071357",
    },
    {
      id: 7,
      name: "Solange Almendra",
      phone: "+56 9 3524 6735",
    },
    {
      id: 8,
      name: "Paulina Villalobos",
      phone: "+56 9 3107 5475",
    },
    {
      id: 9,
      name: "Catalina Aguilera",
      phone: "+56 9 4951 7225",
    },
    {
      id: 10,
      name: "Cristian Fernández",
      phone: "+56 9 8210 9151",
    },
    {
      id: 11,
      name: "Javiera Vergara",
      phone: "+56 9 2225 3122",
    },
    {
      id: 12,
      name: "Valentina Leon",
      phone: "+56 9 3276 6499",
    },
    {
      id: 13,
      name: "Barbara Godoy",
      phone: "+56 9 9868 3984",
    },
    {
      id: 14,
      name: "Jossefa Cabanas",
      phone: "+56 9 8898 9425",
    },
  ];

  const clientOptions: DropdownOption[] = hardcodedClients.map((client) => ({
    id: client.id,
    label: client.name,
    value: client.id,
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
      const selectedClient = hardcodedClients.find(
        (client) => client.id === data.client
      );

      if (!selectedClient) {
        throw new Error("Cliente no encontrado");
      }

      const formData = new FormData();
      formData.append("customerName", selectedClient.name);
      formData.append("customerPhone", selectedClient.phone);
      formData.append("shipper", data.shipper || "");
      formData.append("importer", data.importer || "");
      formData.append("ref", data.ref || "");
      formData.append("incoterm", data.incoterm || "");
      formData.append("isInsulated", data.isInsulated.toString());
      formData.append("isFlexitank", data.isFlexitank.toString());

      if (data.file && data.file.length > 0) {
        const file = data.file[0];
        if (file) {
          formData.append("file", file);
        }
      }

      const result = await submitConfirmation(formData);

      downloadFile(result.fileData!, result.filename!, result.contentType!);

      alert("Confirmación enviada exitosamente. El archivo se ha descargado.");
    } catch (error) {
      console.error("Error submitting form:", error);
      alert(
        `Error al enviar la confirmación: ${error instanceof Error ? error.message : "Error desconocido"}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white border border-gray-200 rounded-xl p-6 w-140 flex flex-col gap-4"
      >
        <h1 className="text-2xl font-bold text-center">Nueva Confirmación</h1>
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
          {isSubmitting ? "Enviando..." : "Solicitar confirmación"}
        </Button>
      </form>
    </div>
  );
}
