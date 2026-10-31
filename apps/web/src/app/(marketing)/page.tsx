"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  Sparkles,
  Layers,
  Shield,
  Eye,
  Film,
  Compass,
  Repeat,
  Heart,
  ExternalLink,
} from "lucide-react";
import ScrollExpandMedia from "@/components/ui/scroll-expansion-hero";
import { TravelerLogo } from "@/components/ui/traveler-logo";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { ArchCard } from "@/components/ui/arch-card";
import { apiClient } from "@/lib/api-client";

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
    <div className="relative min-h-screen bg-bg text-text selection:bg-accent/20 selection:text-accent font-sans">
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
            <PrimaryButton className="px-4 py-1.5 text-xs">
              Step through
            </PrimaryButton>
          </Link>
        </nav>
      </header>

      {/* 2. Portal Expansion Hero (Section 12 & Section 6.4) */}
      <ScrollExpandMedia
        mediaType="image"
        mediaSrc="/art/portal-window.webp"
        bgImageSrc="/art/night-void.webp"
        title="Step Through the Dream"
        date="The Dream Machine"
        scrollToExpand="Scroll to step through"
        textBlend={false}
      >
        {/* The 8 Sections from Design.md §8 revealed after expansion */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 space-y-32">
          {/* Section 1: The Awakening */}
          <section className="text-center space-y-6 max-w-3xl mx-auto pt-8">
            <h2 className="font-display text-3xl sm:text-5xl font-light text-text leading-tight">
              Tell us the fragments. <br />
              <span className="italic font-serif text-accent">We&apos;ll find the way back.</span>
            </h2>
            <p className="font-serif italic text-base sm:text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
              &ldquo;You wake with only pieces. A door, a tide, a face you almost knew.
              We stitch without flattening the strange, and give your shadows voice.&rdquo;
            </p>
          </section>

          {/* Section 2: Fragments */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div className="space-y-4">
              <span className="text-xs uppercase tracking-widest text-accent font-mono">
                02 · The Fragments
              </span>
              <h3 className="font-display text-2xl sm:text-4xl text-text font-medium leading-tight">
                You wake with only pieces.
              </h3>
              <p className="font-serif italic text-base sm:text-lg text-text-muted">
                A door, a tide, a face you almost knew.
              </p>
              <p className="text-xs sm:text-sm font-serif text-text-muted leading-relaxed">
                Record your broken recollections the second you open your eyes. Speak into the pulsing halo microphone or write on the dark water surface. Even a color, a phrase, or a feeling will do.
              </p>
            </div>
            <ArchCard isDoubleFrame className="overflow-hidden p-2">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-hairline/40">
                <Image
                  src="/art/fragments.webp"
                  alt="Drifting dream frames and half-remembered fragments"
                  fill
                  sizes="(max-width: 768px) 100vw, 500px"
                  className="object-cover"
                />
              </div>
            </ArchCard>
          </section>

          {/* Section 3: Weave */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center md:flex-row-reverse">
            <ArchCard isDoubleFrame className="overflow-hidden p-2 md:order-2">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-hairline/40">
                <Image
                  src="/art/weave.webp"
                  alt="Stitching fragments together with golden light"
                  fill
                  sizes="(max-width: 768px) 100vw, 500px"
                  className="object-cover"
                />
              </div>
            </ArchCard>
            <div className="space-y-4 md:order-1">
              <span className="text-xs uppercase tracking-widest text-accent font-mono">
                03 · Reconstruction
              </span>
              <h3 className="font-display text-2xl sm:text-4xl text-text font-medium leading-tight">
                We stitch without flattening the strange.
              </h3>
              <p className="text-xs sm:text-sm font-serif text-text-muted leading-relaxed">
                Emotional continuity over ordinary physics. Inferred narrative gaps remain visible and honest on tap. Toggle between a raw Faithful recount and a cinematic Authored arc, or repair any beat inline.
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-2 text-xs font-serif text-accent italic">
                  <Sparkles className="w-4 h-4" />
                  <span>The Recognition Moment: you know it is yours.</span>
                </span>
              </div>
            </div>
          </section>

          {/* Section 4: Reflect */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div className="space-y-4">
              <span className="text-xs uppercase tracking-widest text-accent font-mono">
                04 · The Lantern Threads
              </span>
              <h3 className="font-display text-2xl sm:text-4xl text-text font-medium leading-tight">
                Not answers. Lanterns.
              </h3>
              <p className="font-serif italic text-base sm:text-lg text-text-muted">
                Here are a few ways to read it. Keep the ones that glow.
              </p>
              <p className="text-xs sm:text-sm font-serif text-text-muted leading-relaxed">
                Every reflection thread is grounded in your exact verbatim words. Filter through emotional, archetypal, day-residue, or relational perspectives without dogma.
              </p>
            </div>
            <ArchCard isDoubleFrame className="overflow-hidden p-2">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-hairline/40">
                <Image
                  src="/art/reflect.webp"
                  alt="Paper lanterns glowing over still waters at dawn"
                  fill
                  sizes="(max-width: 768px) 100vw, 500px"
                  className="object-cover"
                />
              </div>
            </ArchCard>
          </section>

          {/* Section 5: Remember */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <ArchCard isDoubleFrame className="overflow-hidden p-2 md:order-2">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-hairline/40">
                <Image
                  src="/art/remember.webp"
                  alt="Constellation of symbols linked across the forest night"
                  fill
                  sizes="(max-width: 768px) 100vw, 500px"
                  className="object-cover"
                />
              </div>
            </ArchCard>
            <div className="space-y-4 md:order-1">
              <span className="text-xs uppercase tracking-widest text-accent font-mono">
                05 · Personal Lexicon
              </span>
              <h3 className="font-display text-2xl sm:text-4xl text-text font-medium leading-tight">
                Your symbols, in your own language.
              </h3>
              <p className="text-xs sm:text-sm font-serif text-text-muted leading-relaxed">
                No generic dream dictionaries. A river or an open doorway means what it has proven to mean across your personal nights. Your subconscious builds its own dictionary with every reflection you validate.
              </p>
            </div>
          </section>

          {/* Section 6: Watch */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div className="space-y-4">
              <span className="text-xs uppercase tracking-widest text-accent font-mono">
                06 · 3D Dream Theater
              </span>
              <h3 className="font-display text-2xl sm:text-4xl text-text font-medium leading-tight">
                Then watch it walk.
              </h3>
              <p className="text-xs sm:text-sm font-serif text-text-muted leading-relaxed">
                Step into the theater where your reconstructed narrative becomes a real-time cel-shaded 3D animated performance. Directed camera shots, living world kits, and character locomotion driven by validated dream grammar.
              </p>
            </div>
            <ArchCard isDoubleFrame className="overflow-hidden p-2">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-hairline/40">
                <Image
                  src="/art/watch-frame.webp"
                  alt="The ornate cinema frame floating over a dream landscape"
                  fill
                  sizes="(max-width: 768px) 100vw, 500px"
                  className="object-cover"
                />
              </div>
            </ArchCard>
          </section>

          {/* Section 7: Privacy */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <ArchCard isDoubleFrame className="overflow-hidden p-2 md:order-2">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-hairline/40">
                <Image
                  src="/art/vault.webp"
                  alt="Sealed stone vault at the bottom of a dark pool"
                  fill
                  sizes="(max-width: 768px) 100vw, 500px"
                  className="object-cover"
                />
              </div>
            </ArchCard>
            <div className="space-y-4 md:order-1">
              <span className="text-xs uppercase tracking-widest text-accent font-mono">
                07 · The Private Vault
              </span>
              <h3 className="font-display text-2xl sm:text-4xl text-text font-medium leading-tight">
                Your dreams stay yours.
              </h3>
              <p className="text-xs sm:text-sm font-serif text-text-muted leading-relaxed">
                Zero retention on speech servers. Dreams are encrypted at rest with AES-GCM and never logged or used to train third-party foundation models. Complete JSON export and one-click permanent hard deletion.
              </p>
            </div>
          </section>

          {/* Section 8: Final CTA */}
          <section className="relative text-center space-y-8 max-w-2xl mx-auto pt-12 pb-8">
            <div className="w-16 h-16 mx-auto rounded-full border border-accent/40 bg-accent/10 flex items-center justify-center">
              <TravelerLogo size={36} />
            </div>
            <div className="space-y-3">
              <h2 className="font-display text-4xl sm:text-5xl font-light text-text">
                Open the door.
              </h2>
              <p className="font-serif italic text-base sm:text-lg text-text-muted">
                Capture the dream before the morning tide pulls it away.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href={primaryTargetHref}>
                <PrimaryButton
                  icon={<ArrowRight className="w-4 h-4" />}
                  className="px-8 py-4 text-base"
                >
                  Step through
                </PrimaryButton>
              </Link>
              <Link href="/journal">
                <SecondaryButton className="px-6 py-3.5 text-sm">
                  Read the Journal
                </SecondaryButton>
              </Link>
            </div>
          </section>
        </div>
      </ScrollExpandMedia>

      {/* 3. Footer with Water Reflection (Section 8 item 8 & Section 5) */}
      <footer className="relative border-t border-hairline/60 bg-bg pt-16 pb-12 overflow-hidden">
        {/* Subtle radial water glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(85,156,169,0.18),transparent_70%)] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-6 relative z-10 flex flex-col items-center text-center space-y-6">
          {/* Mirrored water reflection of the Traveler logo */}
          <div className="flex flex-col items-center">
            <div className="select-none pointer-events-none">
              <TravelerLogo size={36} />
            </div>
            {/* Mirror reflection */}
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
            Privacy-First Architecture · Zero-Retention Audio · AES-GCM Encrypted
          </p>
        </div>
      </footer>
    </div>
  );
}

