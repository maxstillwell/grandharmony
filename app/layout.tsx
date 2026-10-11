import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Grand Harmony | Thoughtful Investment. Enduring Value.", description: "Grand Harmony is a Melbourne-based property investment and development company." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
