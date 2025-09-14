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
          <div className="flex items-center gap-2">
            <Image src={InterTankLogo} alt="Intertank" width={60} height={60} />
            <p className="text-lg font-bold">INTER TANK</p>
          </div>
          <div className="flex gap-4 items-center">
            <p className="text-md ">Bienvenid@, {session.user.firstName}</p>
            <SignOutButton />
          </div>
        </div>
      ) : (
        <></>
      )}
    </>
  );
}
