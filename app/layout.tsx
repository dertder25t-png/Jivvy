import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// import { Header } from "@/components/layout/Header"; // Retiring old header for Sidebar approach on Desktop
import { MobileMainNav } from "@/components/layout/MobileMainNav";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Jivvy | Soft Pop Studio",
  description: "Neo-Brutalist Knowledge Engine",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={cn(inter.className, "bg-background text-foreground overflow-hidden grain-overlay selection:bg-lime-400 selection:text-black")}>

        {/* ADAPTIVE SHELL: Grid on Desktop, Stack on Mobile */}
        <div className="h-screen w-screen grid grid-cols-1 md:grid-cols-[240px_1fr] overflow-hidden">

          {/* ZONE 1: Sidebar (Desktop Only) */}
          <AppSidebar />

          {/* ZONE 2: Main Content Area */}
          <main className="relative h-full w-full overflow-hidden flex flex-col bg-background/50">
            {/* Mobile Header could go here if needed, or inside specific pages */}
            {/* For now, we let pages handle their own headers or basic spacing */}
            <div className="flex-1 overflow-auto md:overflow-hidden relative">
              {children}
            </div>

            {/* Bottom safe area spacer for mobile nav */}
            <div className="h-16 md:h-0 w-full flex-shrink-0" />
          </main>

        </div>

        {/* ZONE 3: Mobile Navigation (Fixed Bottom) */}
        <MobileMainNav />

      </body>
    </html>
  );
}
