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
      name: "Trinidad Cofré",
      phone: "+56 9 643 589 13",
    },
    {
      id: 3,
      name: "Cesar Varela",
      phone: "+56 932077575",
    },
    {
      id: 4,
      name: "Omar Mendez",
      phone: "+56 97430 8360",
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
      phone: "NA",
    },
  ];

  // Transform clients data to dropdown options format
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
      formData.append("shipper", data.shipper);
      formData.append("importer", data.importer);
      formData.append("ref", data.ref);
      formData.append("incoterm", data.incoterm);
      formData.append("isInsulated", data.isInsulated.toString());

      if (data.file && data.file.length > 0) {
        const file = data.file[0];
        if (file) {
          formData.append("file", file);
        }
      }

      const result = await submitConfirmation(formData);

      if (!result.success) {
        console.log(result);
        throw new Error(result.error);
      }

      // Download the response file
      downloadFile(result.fileData!, result.filename!, result.contentType!);

      // Show success message
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
        className="bg-white border border-gray-200 rounded-xl p-6 w-140 flex flex-col gap-12"
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
              {...register("shipper", { required: "Shipper es requerido" })}
            />
            {errors.shipper && (
              <p className="text-red-500 text-sm mt-1">
                {errors.shipper.message}
              </p>
            )}
          </div>

          <div>
            <Input
              type="text"
              id="importer"
              label="Importer"
              {...register("importer", { required: "Importer es requerido" })}
            />
            {errors.importer && (
              <p className="text-red-500 text-sm mt-1">
                {errors.importer.message}
              </p>
            )}
          </div>

          <div>
            <Input
              type="text"
              id="ref"
              label="REF"
              {...register("ref", { required: "REF es requerido" })}
            />
            {errors.ref && (
              <p className="text-red-500 text-sm mt-1">{errors.ref.message}</p>
            )}
          </div>

          <div>
            <Input
              type="text"
              id="incoterm"
              label="Incoterm"
              {...register("incoterm", { required: "Incoterm es requerido" })}
            />
            {errors.incoterm && (
              <p className="text-red-500 text-sm mt-1">
                {errors.incoterm.message}
              </p>
            )}
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

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Enviando..." : "Solicitar confirmación"}
        </Button>
      </form>
    </div>
  );
}
