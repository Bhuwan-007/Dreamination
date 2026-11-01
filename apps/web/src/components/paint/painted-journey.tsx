"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { TravelerLogo } from "@/components/ui/traveler-logo";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SecondaryButton } from "@/components/ui/secondary-button";
interface PaintedJourneyProps {
  primaryTargetHref: string;
}
interface JourneyScene {
  id: string;
  eyebrow: string;
  headline: string;
  subline: string;
  body: string;
  honestNote?: string;
  artSrc: string;
  calmZoneClass: string;
  isCTA?: boolean;
}
const JOURNEY_SCENES: JourneyScene[] = [
  {
    id: "reflect",
    eyebrow: "01 · The Lantern Threads",
    headline: "Not answers. Lanterns.",
    subline: "Here are a few ways to read it. Keep the ones that glow.",
    body: "Every reflection thread is grounded in your exact verbatim words. Filter through emotional, archetypal, day-residue, or relational perspectives without dogma.",
    artSrc: "/art/reflect.webp",
    calmZoneClass: "items-start text-left max-w-xl ml-6 sm:ml-16 lg:ml-24",
  },
  {
    id: "remember",
    eyebrow: "02 · Personal Lexicon",
    headline: "Your symbols, in your own language.",
    subline: "No generic dream dictionaries.",
    body: "A river or an open doorway means what it has proven to mean across your personal nights. Your subconscious builds its own dictionary with every reflection you validate.",
    artSrc: "/art/remember.webp",
    calmZoneClass: "items-end text-right max-w-xl mr-6 sm:mr-16 lg:mr-24 ml-auto",
  },
  {
    id: "watch",
    eyebrow: "03 · 3D Dream Theater",
    headline: "Then watch it walk.",
    subline: "A living cinema of your subconscious.",
    body: "Step into the theater where your reconstructed narrative becomes a real-time cel-shaded 3D animated performance. Directed camera shots, living world kits, and character locomotion driven by validated dream grammar.",
    artSrc: "/art/watch-frame.webp",
    calmZoneClass: "items-start text-left max-w-xl ml-6 sm:ml-16 lg:ml-24",
  },
  {
    id: "privacy",
    eyebrow: "04 · The Private Vault",
    headline: "Your dreams stay yours.",
    subline: "Truthful Privacy Architecture",
    body: "Your dreams are encrypted before they are stored. We never write them to our logs. Export everything, or delete it all, whenever you like.",
    honestNote: "AI steps currently use a third-party model service. A fully local mode is planned.",
    artSrc: "/art/vault.webp",
    calmZoneClass: "items-start text-left max-w-xl ml-6 sm:ml-16 lg:ml-24",
  },
  {
    id: "cta-door",
    eyebrow: "05 · The Threshold",
    headline: "Open the door.",
    subline: "Capture the dream before the morning tide pulls it away.",
    body: "",
    artSrc: "/art/cta-door.webp",
    calmZoneClass: "items-center text-center max-w-2xl mx-auto",
    isCTA: true,
  },
];
export function PaintedJourney({ primaryTargetHref }: PaintedJourneyProps) {
  return (
    <div id="painted-journey" className="relative w-full bg-void text-text overflow-hidden">
      {/* Dusk Mist Rise Transition from Chapter V into Night */}
      <div className="relative w-full h-40 bg-gradient-to-b from-transparent via-void/80 to-void flex items-center justify-center pointer-events-none z-20">
        <div className="w-full h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
      </div>
      {JOURNEY_SCENES.map((scene) => (
        <section
          key={scene.id}
          className="relative min-h-[90vh] flex items-center justify-center py-20 px-6 sm:px-12 overflow-hidden"
        >
          {/* Full-Bleed Parallax Painting Backdrop */}
          <div className="absolute inset-0 z-0 select-none pointer-events-none">
            <Image
              src={scene.artSrc}
              alt={scene.headline}
              fill
              sizes="100vw"
              className="object-cover object-center opacity-45 scale-105 transition-transform duration-1000 ease-out"
            />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(9,13,17,0.4)_0%,rgba(9,13,17,0.85)_80%,#090D11_100%)]" />
            <div className="absolute inset-0 bg-void/35" />
          </div>
          {/* Mist-Gradient Dividers */}
          <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-void via-void/50 to-transparent pointer-events-none z-10" />
          <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-void via-void/50 to-transparent pointer-events-none z-10" />
          {/* Integrated Real DOM Text in Calm Zone */}
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className={`relative z-20 flex flex-col space-y-4 ${scene.calmZoneClass}`}
          >
            {scene.isCTA ? (
              <div className="space-y-6 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full border border-accent/40 bg-accent/10 flex items-center justify-center shadow-lantern-sm">
                  <TravelerLogo size={36} />
                </div>
                <div className="space-y-2">
                  <h2 className="font-display text-4xl sm:text-6xl font-light text-cloud leading-tight">
                    {scene.headline}
                  </h2>
                  <p className="font-serif italic text-base sm:text-xl text-text-muted">
                    {scene.subline}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                  <Link href={primaryTargetHref}>
                    <PrimaryButton
                      icon={<ArrowRight className="w-4 h-4" />}
                      className="px-8 py-4 text-base shadow-lantern"
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
              </div>
            ) : (
              <>
                <span className="text-xs font-mono uppercase tracking-widest text-accent">
                  {scene.eyebrow}
                </span>
                <h2 className="font-display text-3xl sm:text-5xl font-light text-cloud leading-tight">
                  {scene.headline}
                </h2>
                <p className="font-serif italic text-sm sm:text-lg text-accent-soft">
                  &ldquo;{scene.subline}&rdquo;
                </p>
                <p className="font-serif text-xs sm:text-sm text-text-muted leading-relaxed max-w-lg">
                  {scene.body}
                </p>
                {scene.honestNote && (
                  <div className="pt-2">
                    <p className="text-[11px] font-mono text-text-subtle border-l-2 border-accent/40 pl-3 py-0.5">
                      {scene.honestNote}
                    </p>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </section>
      ))}
    </div>
  );
}

