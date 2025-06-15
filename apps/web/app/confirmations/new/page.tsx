"use client";

import { Input } from "@/components/ui/Input";
import { Dropdown, DropdownOption } from "@/components/ui/Dropdown";
import { useState } from "react";
import SubmitButton from "@/components/shared/SubmitButton";
import { Checkbox } from "@/components/ui/Checkbox";
import { FileUploader } from "@/components/ui/FileUploader";

export default function NewConfirmationPage() {
  const [selectedClient, setSelectedClient] = useState<string | number>("");

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

  return (
    <div className="h-full flex items-center justify-center">
      <form className="bg-white border border-gray-200 rounded-xl p-6 w-140 flex flex-col gap-12">
        <h1 className="text-2xl font-bold text-center">Nueva Confirmación</h1>
        <div className="flex flex-col gap-4">
          <Dropdown
            id="client"
            name="client"
            label="Cliente"
            options={clientOptions}
            value={selectedClient}
            onChange={setSelectedClient}
            placeholder="Selecciona un cliente"
          />

          <Input type="text" id="shipper" name="shipper" label="Shipper" />

          <Input type="text" id="importer" name="importer" label="Importer" />

          <Input type="text" id="ref" name="ref" label="REF" />

          <Input type="text" id="incoterm" name="incoterm" label="Incoterm" />

          <Checkbox label="Insulado" id="insulated" />

          <FileUploader label="Subir archivo" id="file" />
        </div>
        <SubmitButton>Solicitar confirmación</SubmitButton>
      </form>
    </div>
  );
}
