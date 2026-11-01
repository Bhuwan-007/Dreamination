"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Sparkles } from "lucide-react";
import { TravelerLogo } from "@/components/ui/traveler-logo";
import { PrimaryButton } from "@/components/ui/primary-button";
import { apiClient } from "@/lib/api-client";
import { SoundProvider } from "@/components/paint/sound-provider";
import { PaintTheatre } from "@/components/paint/paint-theatre";
import { PaintedJourney } from "@/components/paint/painted-journey";
export default function MarketingLandingPage() {
  const [hasDreams, setHasDreams] = useState<boolean>(false);
  const isDev = process.env.NEXT_PUBLIC_DEV_TOOLS === "true";
  useEffect(() => {
    async function checkExistingDreams() {
      try {
        const dreams = await apiClient.listDreams();
        if (Array.isArray(dreams) && dreams.length > 0) {
          setHasDreams(true);
        }
      } catch {
        setHasDreams(false);
      }
    }
    checkExistingDreams();
  }, []);
  const primaryTargetHref = hasDreams ? "/journal" : "/capture";
  return (
    <SoundProvider>
      <div className="relative min-h-screen bg-bg text-text selection:bg-accent/20 selection:text-accent font-sans">
        {/* 1. Header (floats transparently over Scene I) */}
        <header className="fixed top-0 left-0 right-0 z-40 px-6 py-3.5 border-b border-hairline/40 bg-void/50 backdrop-blur-md flex items-center justify-between transition-colors">
          <Link href="/" className="flex items-center gap-3 group">
            <TravelerLogo size={30} />
            <div className="flex flex-col">
              <span className="font-display tracking-wider text-base text-text font-medium leading-none">
                The Dream Machine
              </span>
              <span className="text-[10px] font-serif text-text-subtle tracking-widest uppercase mt-0.5">
                A dream journal that remembers you.
              </span>
            </div>
          </Link>
          <nav className="flex items-center gap-3 text-xs font-serif">
            <Link
              href="/journal"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-hairline/60 text-text-muted hover:text-text hover:border-accent/40 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-accent" />
              <span>Journal</span>
            </Link>
            <Link
              href="/lexicon"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-hairline/60 text-text-muted hover:text-text hover:border-accent/40 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Lexicon</span>
            </Link>
            {isDev && (
              <Link
                href="/dev"
                className="px-3 py-1.5 rounded-full border border-hairline text-text-subtle hover:text-accent font-mono text-[11px] transition-colors"
                title="Internal Diagnostics"
              >
                /dev
              </Link>
            )}
            <Link href={primaryTargetHref}>
              <PrimaryButton className="px-4 py-1.5 text-xs shadow-lantern-sm">
                Step through
              </PrimaryButton>
            </Link>
          </nav>
        </header>
        {/* 2. Merged Hero: The Paint Theatre is the First Screen (Scene I H1 in calm zone) */}
        <PaintTheatre primaryTargetHref={primaryTargetHref} />
        {/* 3. The Painted Journey: 5 Full-Bleed Scenes replacing old black boxed cards */}
        <PaintedJourney primaryTargetHref={primaryTargetHref} />
        {/* 4. Footer with Mirrored Water Reflection & Truthful Privacy */}
        <footer className="relative border-t border-hairline/60 bg-bg pt-16 pb-12 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(85,156,169,0.18),transparent_70%)] pointer-events-none" />
          <div className="max-w-5xl mx-auto px-6 relative z-10 flex flex-col items-center text-center space-y-6">
            <div className="flex flex-col items-center">
              <div className="select-none pointer-events-none">
                <TravelerLogo size={36} />
              </div>
              <div className="opacity-20 transform scale-y-[-1] blur-[1px] select-none pointer-events-none mt-1">
                <TravelerLogo size={36} />
              </div>
            </div>
            <div className="space-y-1">
              <span className="font-display tracking-widest text-sm text-text block">
                THE DREAM MACHINE
              </span>
              <p className="text-xs font-serif italic text-text-muted">
                Waking up inside a painting that remembers you.
              </p>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-6 text-xs font-serif text-text-muted">
              <Link href="/journal" className="hover:text-accent transition-colors">
                Journal
              </Link>
              <span className="text-hairline">·</span>
              <Link href="/lexicon" className="hover:text-accent transition-colors">
                Lexicon & Weather
              </Link>
              <span className="text-hairline">·</span>
              <Link href="/settings" className="hover:text-accent transition-colors">
                Settings & Vault
              </Link>
              <span className="text-hairline">·</span>
              <Link href="/capture" className="hover:text-accent transition-colors">
                Capture Sanctum
              </Link>
            </nav>
            <p className="text-[11px] font-mono text-text-subtle pt-4">
              Encrypted at rest · Never logged · Export or delete anytime.
            </p>
          </div>
        </footer>
      </div>
    </SoundProvider>
  );
}
