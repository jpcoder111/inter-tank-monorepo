import { getSession } from "@/lib/session";
import SignOutButton from "@/components/SignOutButton";
import InterTankLogo from "@/public/intertank.jpeg";
import Image from "next/image";

export async function AppBar() {
  const session = await getSession();

  return (
    <>
      {session && session.user ? (
        <div className="flex items-center justify-between px-4 py-2 bg-white h-16 shadow-lg">
          <Image src={InterTankLogo} alt="Intertank" width={60} height={60} />
          <SignOutButton />
        </div>
      ) : (
        <></>
      )}
    </>
  );
}
