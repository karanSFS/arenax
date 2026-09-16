import type { Metadata } from "next";
import { Inter, Orbitron, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ARENAX — Enter the Arena",
    template: "%s | ARENAX",
  },
  description:
    "ARENAX is a real-time multiplayer browser arena game. Select your fighter, enter the arena, and outplay everyone.",
  keywords: ["arena", "multiplayer", "game", "fighting", "browser game"],
  openGraph: {
    title: "ARENAX — Enter the Arena",
    description: "Real-time multiplayer arena battle game",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${orbitron.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-dark-900 text-slate-100 font-sans antialiased">
        <SessionProvider>
          <ToastProvider>
            <div className="scan-line" aria-hidden="true" />
            {children}
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
