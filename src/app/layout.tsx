import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, DM_Mono, Schibsted_Grotesk } from "next/font/google";

import { ThemeProvider } from "@/components/layout/theme-provider";
import "./globals.css";

// One grotesk for everything from body copy to structural figures, plus a
// mono for labels and measurements. Four weights: 400/500 for reading, 600
// for emphasis, 800 for the oversized figures that act as graphic elements.
const grotesk = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  weight: ["400", "500", "600", "800"],
  display: "swap",
});

const mono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

// An italic serif for accent words only -- "Featured *residences*". Used a
// few times per page at display size, never for running text.
const serif = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500"],
  style: ["italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Kestrel — Property Buyer Platform",
    template: "%s · Kestrel",
  },
  description:
    "Transparent, real-time visibility into your construction project: progress, schedule, documents, money and risk, in one place.",
  applicationName: "Kestrel",
  authors: [{ name: "Property Buyer Platform" }],
  openGraph: {
    type: "website",
    title: "Kestrel — Property Buyer Platform",
    description:
      "Transparent, real-time visibility into your construction project: progress, schedule, documents, money and risk, in one place.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning is required by next-themes: it writes the theme
    // class onto <html> before React hydrates, which React would otherwise
    // report as a mismatch on every page load.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${grotesk.variable} ${mono.variable} ${serif.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
