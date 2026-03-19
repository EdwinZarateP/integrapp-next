import type { Metadata } from "next";
import ClientProviders from "@/Componentes/ClientProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "IntegrApp - Integra Logística",
  description: "Plataforma logística integral",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
