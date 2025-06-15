import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppBar } from "@/components/AppBar";
import Navbar from "@/components/Navbar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-100 h-screen flex flex-col">
        <AppBar />
        <div className="flex flex-col flex-1">
          <div className="flex h-full">
            <Navbar />
            <div className="py-4 px-8 flex-1">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
