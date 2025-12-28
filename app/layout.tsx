import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { cn } from "@/lib/utils";
import { initPDFWorker } from '@/lib/pdf-init';

// CALL IT OUTSIDE THE COMPONENT to run immediately on load
if (typeof window !== 'undefined') {
  initPDFWorker();
}

export const metadata: Metadata = {
  title: "Jivvy | Calm Workspace",
  description: "Local-first knowledge engine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(GeistSans.variable, GeistMono.variable)}>
      <body className="font-sans bg-background text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
