"use client";

import { useFeatureRequests } from "@/lib/feature-requests/useFeatureRequests";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function FeatureRequestsPage() {
  const { data: featureRequests, isLoading, isError, error } = useFeatureRequests();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Feature Requests</h1>
        <div className="text-center py-8 text-gray-500">Cargando...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Feature Requests</h1>
        <div className="text-center py-8 text-red-500">
          Error: {error?.message}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Feature Requests</h1>
        <Button onClick={() => router.push("/feature-requests/new")}>
          Nuevo Feature Request
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Titulo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descripcion
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Creado por
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha de creacion
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {featureRequests?.map((fr) => (
              <tr key={fr.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {fr.title}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                  {fr.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {`${fr.createdBy.firstName || ""} ${fr.createdBy.lastName || ""}`.trim() || fr.createdBy.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(fr.createdAt).toLocaleDateString("es-ES", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {featureRequests?.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No hay feature requests todavia
          </div>
        )}
      </div>
    </div>
  );
}
