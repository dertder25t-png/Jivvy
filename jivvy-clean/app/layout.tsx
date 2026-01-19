import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Use Inter
import "./globals.css";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { SyncProvider } from "@/components/providers/SyncProvider";
import ConvexClientProvider from "@/components/providers/ConvexClientProvider"; // Add this
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] }); // Initialize Inter

export const metadata: Metadata = {
  title: "Jivvy",
  description: "Advanced Academic Workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <Script src="https://accounts.google.com/gsi/client" strategy="beforeInteractive" />
        <ConvexClientProvider>
          <AuthProvider>
            <SyncProvider>
              <AppLayout>{children}</AppLayout>
            </SyncProvider>
          </AuthProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
