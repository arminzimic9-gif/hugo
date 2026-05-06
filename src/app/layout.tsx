import type { Metadata } from "next";
import { Orbitron, Rajdhani, Geist_Mono } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HUGO: NEURAL OVERLOAD",
  description: "A High-Tech Cyberpunk RPG Experience",
};

import DeviceGuard from "@/components/DeviceGuard";
import CustomCursor from "@/components/CustomCursor";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${orbitron.variable} ${rajdhani.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="noise-overlay pointer-events-none"></div>
        <div className="scanlines pointer-events-none"></div>
        <DeviceGuard>
          {children}
        </DeviceGuard>
        <CustomCursor />
      </body>
    </html>
  );
}
