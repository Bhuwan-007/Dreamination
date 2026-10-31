import type { Metadata } from "next";
import { Fraunces, Newsreader, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { GrainOverlay } from "@/components/ui/grain-overlay";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
  adjustFontFallback: false,
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Dream Machine — Step Through the Dream",
  description: "A dream journal that remembers you. Turn fragmented dreams into stories, reflections, and 3D animated films.",
};

const themeInitScript = `
(() => {
  try {
    const pref = localStorage.getItem('theme');
    const h = new Date().getHours();
    const auto = (h >= 19 || h < 6) ? 'night' : 'dawn';
    const isCapture = window.location.pathname.startsWith('/capture');
    document.documentElement.dataset.theme = isCapture ? 'night' : ((!pref || pref === 'auto') ? auto : pref);
  } catch (e) {
    document.documentElement.dataset.theme = 'night';
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="night"
      className={`${fraunces.variable} ${newsreader.variable} ${instrumentSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-bg text-text antialiased selection:bg-accent/30 selection:text-accent-soft font-sans">
        <ToastProvider>
          {children}
          <GrainOverlay />
        </ToastProvider>
      </body>
    </html>
  );
}
