import { authFetch } from "@/lib/authFetch";
import { deleteSession } from "@/lib/session";
import { BACKEND_URL } from "@/lib/constants";
import { NextRequest } from "next/server";
import { redirect, RedirectType } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function GET(req: NextRequest) {
  await authFetch(`${BACKEND_URL}/auth/signout`, { method: "POST" });

  await deleteSession();

  // Revalidate all pages that use authentication
  revalidatePath("/", "layout"); // This will revalidate the root layout and all nested pages
  revalidatePath("/auth/signin");
  revalidatePath("/dashboard");
  revalidatePath("/profile");

  redirect("/", RedirectType.replace);
}
