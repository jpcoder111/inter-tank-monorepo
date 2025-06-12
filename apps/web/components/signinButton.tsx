
import { getSession } from "@/lib/session";
import Link from "next/link";

const signinButton = async () => {
  const session = await getSession();

  return (
    <div className="flex items-center gap-4">
      {!session || !session.user ? (
        <Link href="/auth/signin">Sign in</Link>
      ) : (
        <>
        <p>{session.user.firstName} {session.user.lastName}</p>
        <a href="/api/auth/signout">Sign out</a>
        </>
      )}
    </div>
  );
};

export default signinButton;
