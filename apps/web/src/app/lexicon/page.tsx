"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  apiClient,
  DreamWeatherResponse,
  LexiconEntry,
} from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { PageBackdrop } from "@/components/ui/page-backdrop";
import { ArchCard } from "@/components/ui/arch-card";
import { HaloLoader } from "@/components/ui/halo-loader";
import { PrimaryButton } from "@/components/ui/primary-button";
import {
  BookOpen,
  CloudSun,
  Feather,
  Sparkles,
  Repeat,
  ArrowRight,
} from "lucide-react";

export default function LexiconPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [lexicon, setLexicon] = useState<LexiconEntry[]>([]);
  const [weather, setWeather] = useState<DreamWeatherResponse | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [lexData, weatherData] = await Promise.all([
          apiClient.getLexicon(),
          apiClient.getDreamWeather(),
        ]);
        setLexicon(lexData);
        setWeather(weatherData);
      } catch (err) {
        console.error("Failed to load lexicon or dream weather:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <AppShell>
      <PageBackdrop
        src={lexicon.length === 0 ? "/art/empty-balcony.webp" : "/art/remember.webp"}
        opacity={0.42}
      />

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-12">
        {/* Header inside AppShell */}
        <header className="space-y-3 pb-6 border-b border-hairline">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-accent">
            <Sparkles className="w-4 h-4" />
            <span>Inner Constellations</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-medium text-text">
            Symbol Lexicon & Dream Weather
          </h1>
          <p className="text-sm font-serif text-text-muted max-w-2xl leading-relaxed">
            No generic dream dictionary. Here, a star trail or an open door means what it has proven to mean across your own nights and resonance.
          </p>
        </header>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="py-20">
            <HaloLoader
              stageText="Reading the patterns across your personal dream graph..."
              subText="Synthesizing emotional currents and recurring anchors."
            />
          </div>
        )}

        {!isLoading && (
          <>
            {/* Dream Weather Card */}
            {weather && (
              <ArchCard isDoubleFrame className="p-6 sm:p-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline/60 pb-4">
                  <div className="flex items-center gap-2.5">
                    <CloudSun className="w-5 h-5 text-accent" />
                    <div>
                      <h3 className="text-sm font-serif font-medium text-text">
                        Current Dream Weather
                      </h3>
                      <span className="text-[11px] text-text-muted font-serif">
                        Across {weather.dream_count} recorded night{weather.dream_count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  {weather.dominant_emotions && weather.dominant_emotions.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-serif text-text-subtle">Prevailing tone:</span>
                      {weather.dominant_emotions.map((e, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-0.5 rounded-full text-[11px] font-serif border border-hairline bg-surface-raised text-accent-soft capitalize"
                        >
                          {e.emotion} ({e.count})
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Synthesis Paragraph */}
                <p className="text-sm sm:text-base font-serif text-text leading-relaxed font-light italic">
                  &ldquo;{weather.weather_summary}&rdquo;
                </p>

                {/* Recurring Motifs Row */}
                {weather.recurring_motifs && weather.recurring_motifs.length > 0 && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-serif text-text-subtle flex items-center gap-1">
                      <Repeat className="w-3.5 h-3.5 text-link" />
                      <span>Recurring anchors:</span>
                    </span>
                    {weather.recurring_motifs.map((motif, mIdx) => (
                      <span
                        key={mIdx}
                        className="px-2.5 py-1 rounded-lg text-xs font-serif border border-hairline bg-surface-raised text-text flex items-center gap-1.5"
                      >
                        <span className="text-link font-medium">{motif.name}</span>
                        <span className="text-xs text-text-subtle">×{motif.appearances}</span>
                      </span>
                    ))}
                  </div>
                )}
              </ArchCard>
            )}

            {/* Learned Symbol Lexicon Grid */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-hairline/60 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-serif font-medium text-text">
                    Learned Symbol Lexicon
                  </h3>
                </div>
                <span className="text-xs font-serif text-text-subtle">
                  {lexicon.length} symbol{lexicon.length === 1 ? "" : "s"} tracked
                </span>
              </div>

              {lexicon.length === 0 ? (
                <ArchCard isDoubleFrame isArchedTop className="py-16 text-center space-y-4 max-w-md mx-auto p-8">
                  <Feather className="w-8 h-8 text-text-subtle mx-auto" />
                  <h4 className="text-sm font-serif text-text">No learned symbols yet</h4>
                  <p className="text-xs font-serif text-text-muted leading-relaxed">
                    As you approve dreams and click &ldquo;That resonates&rdquo; or &ldquo;That felt different&rdquo; in the Reflection phase, your personal symbol meanings will automatically learn and appear here.
                  </p>
                  <div className="pt-2">
                    <Link href="/capture">
                      <PrimaryButton icon={<ArrowRight className="w-4 h-4" />}>
                        Capture a Dream
                      </PrimaryButton>
                    </Link>
                  </div>
                </ArchCard>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {lexicon.map((entry) => (
                    <ArchCard
                      key={entry.entity_id}
                      isInteractive
                      isDoubleFrame
                      className="p-6 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-serif font-medium text-text flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-accent animate-pulse motion-reduce:animate-none" />
                          <span>{entry.canonical_name}</span>
                        </h4>
                        <span className="text-[11px] font-serif text-text-subtle">
                          {entry.meanings.reduce((acc, m) => acc + m.evidence_count, 0)} evidence point(s)
                        </span>
                      </div>

                      {/* Meanings Distribution List */}
                      <div className="space-y-2.5">
                        {entry.meanings.map((m, mIdx) => {
                          const pct = Math.round(m.probability * 100);
                          return (
                            <div key={mIdx} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-serif">
                                <span className="text-text-muted">{m.label}</span>
                                <span className="text-accent font-medium">{pct}%</span>
                              </div>
                              {/* Probability Bar */}
                              <div className="h-1.5 rounded-full bg-bg overflow-hidden border border-hairline/40">
                                <div
                                  className="h-full bg-gradient-to-r from-accent/70 to-accent rounded-full transition-all duration-500"
                                  style={{ width: `${Math.max(5, pct)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ArchCard>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
