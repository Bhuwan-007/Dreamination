import type { Metadata } from "next";
import { Fraunces, Newsreader, Instrument_Sans } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="night" className={`${fraunces.variable} ${newsreader.variable} ${instrumentSans.variable}`}>
      <body className="bg-void text-cloud antialiased selection:bg-lantern/30 selection:text-lantern-soft">
        {children}
      </body>
    </html>
  );
}
