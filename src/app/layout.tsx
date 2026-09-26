import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { Analytics } from "@/components/analytics";
import "./globals.css";

const inter = Inter({ variable: "--font-sans-stack", subsets: ["latin"] });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-mono-stack", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://carltine.com"),
  title: {
    default: "Carltine — Route every LLM call to the cheapest model that can do the job",
    template: "%s · Carltine",
  },
  description:
    "An open-source LLM router that scores each request, picks the cheapest capable model, and writes every decision to a tamper-evident ledger so your savings are provable.",
  keywords: [
    "llm router",
    "model routing",
    "llm cost optimization",
    "openrouter alternative",
    "litellm alternative",
    "ai gateway",
    "token cost",
  ],
  authors: [{ name: "Carltine" }],
  openGraph: {
    type: "website",
    url: "https://carltine.com",
    title: "Carltine — the cheapest capable model for every request",
    description:
      "Open-source LLM routing with a tamper-evident audit trail. Bring your own key, prove your savings.",
    siteName: "Carltine",
  },
  twitter: {
    card: "summary_large_image",
    title: "Carltine — the cheapest capable model for every request",
    description:
      "Open-source LLM routing with a tamper-evident audit trail. Bring your own key, prove your savings.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistSans.variable} ${geistMono.variable}`}
      >
        <Analytics />
        {children}
      </body>
    </html>
  );
}
