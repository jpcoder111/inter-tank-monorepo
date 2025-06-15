import Image, { type ImageProps } from "next/image";
import { Button } from "@repo/ui/button";
import styles from "./page.module.css";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getSession();

  return (
    <main className="flex flex-1 justify-center items-center">
      <h1 className="text-2xl font-bold">
        Bienvenido a Intertank, {session?.user?.firstName}
      </h1>
    </main>
  );
}
