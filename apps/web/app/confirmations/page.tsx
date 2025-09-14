import Link from "next/link";

export default async function DashboardPage() {
  return (
    <div className="flex flex-1 justify-between">
      <div>SOON: Aquí se dejarán las confirmaciones antiguas</div>
      <Link
        className="bg-blue-500 text-white px-4 py-2 rounded-md h-fit"
        href="/confirmations/new"
      >
        Nueva confirmación
      </Link>
    </div>
  );
}
