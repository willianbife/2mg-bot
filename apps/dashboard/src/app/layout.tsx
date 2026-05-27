import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "2mg Community Suite",
  description: "Dashboard profissional para bots Discord premium."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
