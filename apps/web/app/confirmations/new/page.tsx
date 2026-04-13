"use client";

import { useAppSettings } from "@/lib/app-settings/useAppSettings";
import ConfirmationFormV1 from "./_components/ConfirmationFormV1";
import ConfirmationFormV2 from "./_components/ConfirmationFormV2";

export default function NewConfirmationPage() {
  const { data: settings, isLoading } = useAppSettings();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p>Cargando...</p>
      </div>
    );
  }

  if (settings?.useNewConfirmationForm) {
    return <ConfirmationFormV2 />;
  }

  return <ConfirmationFormV1 />;
}
