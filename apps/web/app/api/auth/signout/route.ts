import { deleteSession, getSession } from "@/lib/session";
import { BACKEND_URL } from "@/lib/constants";
import { redirect, RedirectType } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function GET() {
  const session = await getSession();

  // Call backend signout if we have a session
  if (session?.accessToken) {
    try {
      await fetch(`${BACKEND_URL}/auth/signout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
    } catch (error) {
      // Continue with local signout even if backend fails
      console.error("Backend signout failed:", error);
    }
  }

  await deleteSession();

  revalidatePath("/", "layout");
  revalidatePath("/auth/signin");
  revalidatePath("/dashboard");
  revalidatePath("/profile");

  redirect("/", RedirectType.replace);
}
