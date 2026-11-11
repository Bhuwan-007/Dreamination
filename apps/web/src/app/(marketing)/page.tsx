"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Sparkles,
  Mic,
  Compass,
  Waves,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { TravelerLogo } from "@/components/ui/traveler-logo";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { ArchCard } from "@/components/ui/arch-card";

export default function MarketingLandingPage() {
  return (
    <div className="relative min-h-screen bg-bg text-text selection:bg-accent/20 selection:text-accent font-sans flex flex-col justify-between">
      {/* Ambient background glows (CSS only, zero image weight) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-lake/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-[450px] h-[450px] bg-accent/5 rounded-full blur-[130px] pointer-events-none" />

      {/* 1. Sticky Logo Header */}
      <header className="sticky top-0 z-40 w-full border-b border-hairline/60 bg-bg/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <TravelerLogo size={32} />
          <div className="flex flex-col">
            <span className="font-display tracking-wider text-base text-text font-medium leading-none">
              The Dream Machine
            </span>
            <span className="text-[10px] font-serif text-text-subtle tracking-widest uppercase mt-0.5">
              Zero-Retention Dream Sanctum
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
            href="/capture"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-hairline/60 text-text-muted hover:text-text hover:border-accent/40 transition-colors"
          >
            <Mic className="w-3.5 h-3.5 text-accent" />
            <span>Capture</span>
          </Link>

          <Link
            href="/lexicon"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-hairline/60 text-text-muted hover:text-text hover:border-accent/40 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Lexicon</span>
          </Link>

          <Link href="/journal">
            <PrimaryButton className="px-4 py-1.5 text-xs">
              Step through
            </PrimaryButton>
          </Link>
        </nav>
      </header>

      {/* 2. Hero Section */}
      <main className="relative z-10 max-w-4xl mx-auto my-auto px-6 py-20 text-center flex flex-col items-center">
        {/* Arch portal badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/30 bg-surface/80 text-accent text-xs font-serif mb-8 backdrop-blur-md shadow-lantern">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span>The Recognition Moment</span>
        </div>

        <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-light text-text leading-[1.1] tracking-tight mb-8">
          Step through <br className="hidden sm:inline" />
          <span className="italic font-serif text-accent">the dream.</span>
        </h1>

        <p className="font-serif italic text-base sm:text-xl text-text-muted max-w-2xl mx-auto mb-12 leading-relaxed">
          &ldquo;You wake with only fragments—a tide, a door, a face you almost knew.
          We stitch without flattening the strange, and give your shadows voice.&rdquo;
        </p>

        {/* Action Controls: 'Step through' leads to the main Journal page with AppShell */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link href="/journal" className="w-full sm:w-auto">
            <PrimaryButton
              icon={<ArrowRight className="w-4 h-4" />}
              className="w-full sm:w-auto px-8 py-3.5 text-sm shadow-lantern"
            >
              Step through
            </PrimaryButton>
          </Link>

          <Link href="/capture" className="w-full sm:w-auto">
            <SecondaryButton
              icon={<Compass className="w-4 h-4" />}
              className="w-full sm:w-auto px-6 py-3.5 text-sm"
            >
              Capture a Dream
            </SecondaryButton>
          </Link>
        </div>

        {/* 3. Feature Principles (Plain text cards with zero image dependencies) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-20 text-left w-full">
          <ArchCard className="p-6 bg-surface/60 backdrop-blur-sm border-hairline/60">
            <Waves className="w-5 h-5 text-lake mb-4" />
            <h3 className="font-display text-text text-base mb-2">Preserve Dream Logic</h3>
            <p className="text-xs sm:text-sm font-serif text-text-muted leading-relaxed">
              Emotional continuity over ordinary physics. Inferred gaps are flagged and visible on tap.
            </p>
          </ArchCard>

          <ArchCard className="p-6 bg-surface/60 backdrop-blur-sm border-hairline/60">
            <Sparkles className="w-5 h-5 text-accent mb-4" />
            <h3 className="font-display text-text text-base mb-2">Personal Lexicon</h3>
            <p className="text-xs sm:text-sm font-serif text-text-muted leading-relaxed">
              Learned symbol distributions and motifs tracked across your journey. No generic dream dictionaries.
            </p>
          </ArchCard>

          <ArchCard className="p-6 bg-surface/60 backdrop-blur-sm border-hairline/60">
            <ShieldCheck className="w-5 h-5 text-leaf mb-4" />
            <h3 className="font-display text-text text-base mb-2">Zero-Retention Sanctum</h3>
            <p className="text-xs sm:text-sm font-serif text-text-muted leading-relaxed">
              Client-side audio transcription, AES-GCM local-first vault, and zero third-party AI training.
            </p>
          </ArchCard>
        </div>
      </main>

      {/* 4. Plain Minimal Footer */}
      <footer className="relative border-t border-hairline/60 bg-bg py-10 overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 relative z-10 flex flex-col items-center text-center space-y-4">
          <div className="flex flex-col items-center">
            <TravelerLogo size={32} />
          </div>

          <div className="space-y-1">
            <span className="font-display tracking-widest text-xs text-text block">
              THE DREAM MACHINE
            </span>
            <p className="text-[11px] font-serif italic text-text-muted">
              A dream journal that remembers you.
            </p>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-6 text-xs font-serif text-text-muted pt-2">
            <Link href="/journal" className="hover:text-accent transition-colors">
              Journal
            </Link>
            <span className="text-hairline">·</span>
            <Link href="/capture" className="hover:text-accent transition-colors">
              Capture
            </Link>
            <span className="text-hairline">·</span>
            <Link href="/lexicon" className="hover:text-accent transition-colors">
              Lexicon
            </Link>
            <span className="text-hairline">·</span>
            <Link href="/settings" className="hover:text-accent transition-colors">
              Settings & Vault
            </Link>
          </nav>

          <p className="text-[10px] font-mono text-text-subtle pt-2">
            Privacy-First Architecture · Zero-Retention Audio · AES-GCM Encrypted
          </p>
        </div>
      </footer>
    </div>
  );
}
