"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowLeft,
  Sun,
  Moon,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Feather,
  Compass,
} from "lucide-react";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { ArchCard } from "@/components/ui/arch-card";
import { Chip } from "@/components/ui/chip";
import { Tooltip } from "@/components/ui/tooltip";
import { HaloLoader } from "@/components/ui/halo-loader";
import { useToast } from "@/components/ui/toast";
import { TravelerLogo } from "@/components/ui/traveler-logo";

export default function DesignSystemPage() {
  const { toast, errorToast, successToast } = useToast();
  const [currentTheme, setCurrentTheme] = useState<"night" | "dawn">("night");

  const toggleTheme = (theme: "night" | "dawn") => {
    setCurrentTheme(theme);
    document.documentElement.dataset.theme = theme;
  };

  const contrastChecks = [
    { pair: "Cloud (#E9EAEB) on Void (#090D11)", ratio: "16.2:1", role: "Primary Body & Headlines", status: "Pass (AAA)" },
    { pair: "Mist (#BDCEBC) on Void (#090D11)", ratio: "11.8:1", role: "Secondary Navigation & Meta", status: "Pass (AAA)" },
    { pair: "Lantern (#E2B866) on Void (#090D11)", ratio: "10.5:1", role: "Magical Accents & Badges", status: "Pass (AAA)" },
    { pair: "Void (#090D11) on Lantern (#E2B866)", ratio: "10.5:1", role: "Primary Button Labels", status: "Pass (AAA)" },
    { pair: "Lake (#559CA9) on Void (#090D11)", ratio: "6.2:1", role: "Symbolic / Jungian Lenses", status: "Pass (AA)" },
    { pair: "Leaf (#909653) on Void (#090D11)", ratio: "6.2:1", role: "Success Highlights & Day Residue", status: "Pass (AA)" },
    { pair: "Dusk Rose (#C9747C) on Void (#090D11)", ratio: "5.8:1", role: "Muted Error & Distress Warnings", status: "Pass (AA)" },
    { pair: "Sage (#77917F) on Void (#090D11)", ratio: "5.7:1", role: "Captions & Relational Meta", status: "Pass (AA)" },
    { pair: "Dawn Ink (#0C1C17) on Dawn BG (#EEF2EF)", ratio: "15.6:1", role: "Dawn Theme Primary Text", status: "Pass (AAA)" },
    { pair: "Dawn Gold (#8A6422) on Dawn BG (#EEF2EF)", ratio: "4.7:1", role: "Dawn Theme Accents", status: "Pass (AA)" },
  ];

  return (
    <div className="min-h-screen bg-bg text-text transition-colors duration-700 py-12 px-6 lg:px-12">
      <div className="max-w-5xl mx-auto space-y-16">
        {/* Header Bar */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-8 border-b border-hairline">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-full border border-hairline text-text-muted hover:text-text hover:border-accent transition-colors"
              title="Return Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <TravelerLogo size={36} />
              <div>
                <h1 className="text-xl font-display font-medium text-text">
                  Design System & Component Showcase
                </h1>
                <p className="text-xs font-serif text-text-muted">
                  Strictly aligned with Design.md (§3–§7) Tokens, Motion & WCAG AA Contrast
                </p>
              </div>
            </div>
          </div>

          {/* Theme Switcher Toggle */}
          <div className="flex items-center gap-2 p-1 rounded-full border border-hairline bg-surface">
            <button
              onClick={() => toggleTheme("night")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans transition-colors ${
                currentTheme === "night"
                  ? "bg-accent text-bg font-semibold shadow-lantern-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Night</span>
            </button>
            <button
              onClick={() => toggleTheme("dawn")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans transition-colors ${
                currentTheme === "dawn"
                  ? "bg-accent text-bg font-semibold shadow-lantern-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Dawn</span>
            </button>
          </div>
        </header>

        {/* 1. Base Buttons */}
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-display text-text">Buttons & Interactive Triggers</h2>
            <p className="text-xs font-serif text-text-muted">
              Pill shape with lantern gold fill, hairline borders, and micro-press motion.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <PrimaryButton icon={<Sparkles className="w-4 h-4" />}>
              Primary Action
            </PrimaryButton>
            <PrimaryButton isLoading>
              Weaving Dream...
            </PrimaryButton>
            <PrimaryButton disabled>
              Disabled Action
            </PrimaryButton>

            <SecondaryButton icon={<Compass className="w-4 h-4" />}>
              Secondary Action
            </SecondaryButton>
            <SecondaryButton disabled>
              Disabled Secondary
            </SecondaryButton>
          </div>
        </section>

        {/* 2. Arch Cards */}
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-display text-text">ArchCards & Frames</h2>
            <p className="text-xs font-serif text-text-muted">
              Signature arch shape, double hairline frames, and soft nocturnal gold glow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ArchCard className="p-6 space-y-3">
              <div className="text-xs font-mono text-accent uppercase tracking-wider">Standard Card</div>
              <h3 className="font-serif text-base text-text">Nocturnal Memory</h3>
              <p className="text-xs font-serif text-text-muted leading-relaxed">
                Standard surface container with a single hairline border and gentle lantern elevation.
              </p>
            </ArchCard>

            <ArchCard isDoubleFrame isArchedTop className="p-6 space-y-3">
              <div className="text-xs font-mono text-accent uppercase tracking-wider">The Portal Frame</div>
              <h3 className="font-serif text-base text-text">Double Hairline Arched Top</h3>
              <p className="text-xs font-serif text-text-muted leading-relaxed">
                Signature arch top with double hairline frame inset by 6px echoing the primary portal motif.
              </p>
            </ArchCard>

            <ArchCard isInteractive isDoubleFrame className="p-6 space-y-3">
              <div className="text-xs font-mono text-link uppercase tracking-wider">Interactive Card</div>
              <h3 className="font-serif text-base text-text">Hover & Glow</h3>
              <p className="text-xs font-serif text-text-muted leading-relaxed">
                Interactive container with hover elevation, subtle gold border illumination, and cursor feedback.
              </p>
            </ArchCard>
          </div>
        </section>

        {/* 3. Chips & Badges */}
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-display text-text">Semantic Chips (Never Rainbow)</h2>
            <p className="text-xs font-serif text-text-muted">
              Strictly mapped to the four interpretation lenses and dream emotion palettes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Chip variant="lantern" icon={<Compass className="w-3.5 h-3.5" />}>
              Cognitive / Emotional
            </Chip>
            <Chip variant="lake" icon={<Eye className="w-3.5 h-3.5" />}>
              Archetypal / Jungian
            </Chip>
            <Chip variant="leaf" icon={<Clock className="w-3.5 h-3.5" />}>
              Day Residue & Memory
            </Chip>
            <Chip variant="sage" icon={<Feather className="w-3.5 h-3.5" />}>
              Relational & Encounters
            </Chip>
            <Chip variant="dusk-rose" icon={<AlertCircle className="w-3.5 h-3.5" />}>
              Distress / Sensitive
            </Chip>
            <Chip variant="mist">
              General Context
            </Chip>
          </div>
        </section>

        {/* 4. Feedback & Floating Elements (Toasts & Tooltips) */}
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-display text-text">Toasts & Tooltips</h2>
            <p className="text-xs font-serif text-text-muted">
              Calm poetic copy from Design.md §20 with gentle floating paper-lantern styling.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <SecondaryButton onClick={() => successToast("Memory woven into the tapestry.")}>
              Trigger Success Toast
            </SecondaryButton>
            <SecondaryButton onClick={() => toast("A quiet wave passed across the journal.")}>
              Trigger Info Toast
            </SecondaryButton>
            <SecondaryButton onClick={() => errorToast()}>
              Trigger Calm Error Toast
            </SecondaryButton>

            <Tooltip content="Paper lantern guidance tooltip with warm glow">
              <span className="text-xs font-serif text-accent underline decoration-dotted cursor-help">
                Hover for Tooltip
              </span>
            </Tooltip>
          </div>
        </section>

        {/* 5. Halo Loader */}
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-display text-text">Halo Loader</h2>
            <p className="text-xs font-serif text-text-muted">
              Rotating gold ring with orbiting star and evocative stage messages.
            </p>
          </div>

          <ArchCard className="p-8 max-w-md mx-auto">
            <HaloLoader stageText="Giving voices to shadows..." />
          </ArchCard>
        </section>

        {/* 6. Contrast Self-Check Table */}
        <section className="space-y-6 pt-8 border-t border-hairline">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <h2 className="text-lg font-display text-text">WCAG AA Contrast Verification Matrix</h2>
            </div>
            <p className="text-xs font-serif text-text-muted">
              Measured contrast ratios from Design.md §3.3 across Night and Dawn themes.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
            <table className="w-full text-left text-xs font-sans">
              <thead className="border-b border-hairline bg-surface-raised text-text-muted uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Color Pair</th>
                  <th className="px-5 py-3.5">Measured Ratio</th>
                  <th className="px-5 py-3.5">Semantic Application</th>
                  <th className="px-5 py-3.5">Standard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {contrastChecks.map((row, idx) => (
                  <tr key={idx} className="hover:bg-accent/5 transition-colors">
                    <td className="px-5 py-3 font-medium text-text">{row.pair}</td>
                    <td className="px-5 py-3 font-mono text-accent font-semibold">{row.ratio}</td>
                    <td className="px-5 py-3 text-text-muted font-serif">{row.role}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 text-success font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{row.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

