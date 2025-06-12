import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();
  
  if(!session || !session.user) {
    redirect("/auth/signin");
  }
  return <div>DashboardPage</div>;
}   