import Link from "next/link";

export default async function DashboardPage() {
  return (
    <div className="flex flex-1 justify-between">
      <div>Aquí renderearemos las confirmaciones</div>
      <Link
        className="bg-blue-500 text-white px-4 py-2 rounded-md h-fit"
        href="/confirmations/new"
      >
        Nueva confirmación
      </Link>
    </div>
  );
}
