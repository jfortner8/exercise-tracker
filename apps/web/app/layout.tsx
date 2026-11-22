import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Color_Emoji } from "next/font/google";
import { InlineScript } from "@/components/inline-script";
import { ThemeSync } from "@/components/theme-switch";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Activity/sport icons are emoji. Older systems (e.g. Windows 10) lack newer ones like 🛼, so use one
// emoji font everywhere. Google serves it in unicode-range chunks, so only the glyphs used are downloaded.
const notoEmoji = Noto_Color_Emoji({ variable: "--font-emoji", weight: "400", subsets: ["emoji"], preload: false });

export const metadata: Metadata = {
  title: { default: "Exercise Tracker", template: "%s · Exercise Tracker" },
  description: "Plan workouts, log what you actually did, and track personal bests.",
};

// Phone browser chrome (status bar, toolbar) matches the page background (--bg in globals.css).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#111110" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT may set data-theme on <html> before React hydrates.
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${notoEmoji.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <InlineScript html={THEME_SCRIPT} />
      </head>
      <body className="min-h-full font-sans">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
