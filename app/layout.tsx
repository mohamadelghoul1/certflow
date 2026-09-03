import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Certlyn",
  description: "Certification project management for NSW building certifiers",
  // Installable on a phone: "Add to Home Screen" gives an icon that opens
  // straight into the app without the browser's chrome around it — what
  // an inspector standing on a slab wants, one tap and the camera.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Certlyn" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

// Without this, phones lay the page out at a notional 980px and shrink the
// result to fit — which is why the app looked like a zoomed-out desktop on
// a phone rather than a mobile layout, and why none of the responsive
// breakpoints were taking effect there.
//
// viewportFit: "cover" is what lets the bottom tab bar's
// env(safe-area-inset-bottom) padding report a real value on a phone with
// a home indicator, instead of always zero.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1a3a5f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased text-heading font-sans">{children}</body>
    </html>
  );
}
