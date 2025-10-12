import { authFetch } from "@/lib/authFetch";
import { deleteSession } from "@/lib/session";
import { BACKEND_URL } from "@/lib/constants";
import { redirect, RedirectType } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function GET() {
  await authFetch(`${BACKEND_URL}/auth/signout`, { method: "POST" });

  await deleteSession();

  revalidatePath("/", "layout");
  revalidatePath("/auth/signin");
  revalidatePath("/dashboard");
  revalidatePath("/profile");

  redirect("/", RedirectType.replace);
}
