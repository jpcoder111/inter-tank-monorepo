import Link from "next/link";
import SigninButton from "../signinButton";

export function AppBar() {
  return (
      <div className="h-14 flex flex-1 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/">Home</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/profile">Profile</Link>
        </div>
        <SigninButton />
      </div>
  );
}
