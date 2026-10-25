import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { themeScript } from "@/components/theme";
import { SITE } from "@/lib/site";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: "Flo: make your vibe-coded app production-ready", template: "%s · Flo" },
  description: SITE.description,
  applicationName: "Flo",
  openGraph: { type: "website", siteName: "Flo", title: "Flo: make your vibe-coded app production-ready", description: SITE.description, url: SITE.url },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08080a" },
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  return (
    <html lang="en" data-theme="dark" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="grain flex min-h-dvh flex-col font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-fg focus:px-4 focus:py-2 focus:text-bg">
          Skip to content
        </a>
        <Nav />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
      {gaId && <GoogleAnalytics gaId={gaId} />}
    </html>
  );
}
