import { getSession } from "./lib/session";
import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/auth/signin"];

export default async function middleware(req: NextRequest) {
  const session = await getSession();

  const isLoggedIn = !!session?.user;
  const { pathname } = req.nextUrl;

  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/auth/signin";
    if (pathname !== "/") {
      redirectUrl.searchParams.set("redirectTo", pathname);
    }

    return NextResponse.redirect(redirectUrl);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
