import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CertFlow",
  description: "Certification project management for NSW building certifiers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased text-slate-900">{children}</body>
    </html>
  );
}
