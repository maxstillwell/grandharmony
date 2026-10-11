import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://grandharmony.vercel.app"),
  title: { default: "Grand Harmony | Thoughtful Investment. Enduring Value.", template: "%s | Grand Harmony" },
  description: "Grand Harmony is a Melbourne-based property investment and development company.",
  applicationName: "Grand Harmony",
  robots: { index: true, follow: true },
  icons: { icon: "/icon.svg" },
  openGraph: { type: "website", locale: "en_AU", url: "/", siteName: "Grand Harmony", title: "Grand Harmony | Thoughtful Investment. Enduring Value.", description: "Melbourne-based property investment and development." },
  twitter: { card: "summary", title: "Grand Harmony", description: "Thoughtful Investment. Enduring Value." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
