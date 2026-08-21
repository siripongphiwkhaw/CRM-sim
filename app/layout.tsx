import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-app",
  subsets: ["latin"],
});

/**
 * Thai face for the bilingual classification explainer.
 *
 * subsets is ["thai"] and MUST stay that way. next/font derives the
 * @font-face unicode-range from the subsets, so a Thai-only subset means the
 * browser reaches for Noto only on Thai codepoints and falls through to Inter
 * for all Latin -- automatically, per glyph, with no class switching. Adding
 * "latin" here would let Noto's Latin glyphs win inside every element using
 * the font stack and silently restyle the whole app.
 *
 * preload: false because the stack is on <html>, so preloading would fetch a
 * Thai font on every route including the ones that never render a Thai glyph.
 * The @font-face still exists; the browser fetches on first Thai paint.
 *
 * No weight array -- Noto Sans Thai is a variable font.
 */
const notoThai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Jenonutz Cloud — Customer Data Platform",
  description:
    "Demo loyalty CRM / CDP with customers, products, channel data and analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${notoThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
