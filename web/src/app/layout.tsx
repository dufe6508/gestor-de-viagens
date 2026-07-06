import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { BottomNav } from "@/components/bottom-nav";
import { BiometricGate } from "@/components/biometric-gate";
import { AuthGate } from "@/components/auth-gate";
import "./globals.css";

const sans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Gerenciador de Viagens",
  description: "Controle financeiro de excursões",
};

export const viewport: Viewport = {
  themeColor: "#0b0d0c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`dark ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <AuthGate>
          <BiometricGate>
            {children}
            <BottomNav />
          </BiometricGate>
        </AuthGate>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
