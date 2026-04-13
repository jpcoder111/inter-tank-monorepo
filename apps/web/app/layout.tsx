import "./globals.css";
import { AppBar } from "@/components/AppBar";
import Navbar from "@/components/Navbar";
import QueryProvider from "@/providers/QueryProvider";
import { SessionProvider } from "@/providers/SessionProvider";
import { Toaster } from "react-hot-toast";
import { getSession } from "@/lib/session";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch session on server side for initial render
  const session = await getSession();

  return (
    <html lang="en">
      <body className="bg-gray-100 h-screen flex flex-col">
        <SessionProvider initialSession={session}>
          <QueryProvider>
            <Toaster position="top-center" />
            <AppBar />
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex h-full min-h-0">
                <Navbar />
                <div className="py-4 px-8 flex-1 min-h-0 flex flex-col">{children}</div>
              </div>
            </div>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
