import { getSession } from "@/lib/session";
import ProfilePage from "./profile/page";

export default async function Home() {
  const session = await getSession();

  return (
    <main className="flex flex-1 justify-center items-center">
      <h1 className="text-2xl font-bold">
        Bienvenido a Inter Tank, {session?.user?.firstName}
      </h1>
    </main>
  );
}
