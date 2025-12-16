import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Jivvy | Soft Pop Studio",
  description: "Neo-Brutalist Knowledge Engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={cn(inter.className, "bg-background text-foreground overflow-hidden grain-overlay selection:bg-lime-400 selection:text-black")}>

        {/* New Header */}
        <Header />
        <MobileHeader />

        {/* Main Layout Shell */}
        <div className="h-screen w-screen flex flex-col pt-20">

          {/* Main Content Area */}
          <main className="flex-1 relative h-full w-full overflow-hidden">
            {children}
          </main>

          {/* Mobile Navigation */}
          <MobileNav />

        </div>

      </body>
    </html>
  );
}
