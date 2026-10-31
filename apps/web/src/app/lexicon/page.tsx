"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  apiClient,
  DreamWeatherResponse,
  LexiconEntry,
} from "@/lib/api-client";
import {
  ArrowLeft,
  BookOpen,
  CloudSun,
  Compass,
  Feather,
  Sparkles,
  Layers,
  Repeat,
  Heart,
  HelpCircle,
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
    <div className="relative min-h-screen bg-void text-cloud font-sans selection:bg-lantern/20 selection:text-lantern pb-32">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/20 via-void to-void" />

      {/* Top Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-void/80 border-b border-hairline px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/capture"
            className="flex items-center gap-2 text-xs font-serif text-mist hover:text-cloud transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Capture Sanctum</span>
          </Link>

          <div className="text-center">
            <span className="text-xs uppercase tracking-widest text-lantern font-serif">
              Phase VII · Personal Knowledge
            </span>
            <h1 className="text-sm font-serif font-medium text-cloud">
              Symbol Lexicon & Dream Weather
            </h1>
          </div>

          <Link
            href="http://localhost:5173"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-serif text-mist hover:text-lantern transition-colors"
          >
            3D Player ↗
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-10 space-y-12">
        {/* Humble Philosophical Introduction */}
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-serif font-light text-cloud tracking-tight">
            The Vocabulary of Your Subconscious
          </h2>
          <p className="text-xs font-serif italic text-mist/90 leading-relaxed">
            &ldquo;No generic dream dictionary. Here, a star trail or an open door means what it has proven to mean across your own nights and resonance.&rdquo;
          </p>
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="py-24 text-center space-y-4">
            <div className="w-10 h-10 mx-auto rounded-full border border-lantern/80 flex items-center justify-center bg-void/80 text-lantern animate-spin">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-xs text-mist font-serif">
              Reading the patterns across your personal dream graph...
            </p>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Dream Weather Card */}
            {weather && (
              <section className="p-6 sm:p-8 rounded-2xl border border-lantern/30 bg-forest-night/40 backdrop-blur-md shadow-lantern space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline/60 pb-4">
                  <div className="flex items-center gap-2.5">
                    <CloudSun className="w-5 h-5 text-lantern" />
                    <div>
                      <h3 className="text-sm font-serif font-medium text-cloud">
                        Current Dream Weather
                      </h3>
                      <span className="text-[11px] text-mist font-serif">
                        Across {weather.dream_count} recorded night{weather.dream_count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  {weather.dominant_emotions && weather.dominant_emotions.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-serif text-mist/70">Prevailing tone:</span>
                      {weather.dominant_emotions.map((e, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-0.5 rounded-full text-[11px] font-serif border border-lantern/30 bg-lantern/10 text-lantern-soft capitalize"
                        >
                          {e.emotion} ({e.count})
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Synthesis Paragraph */}
                <p className="text-sm sm:text-base font-serif text-cloud/95 leading-relaxed font-light italic">
                  &ldquo;{weather.weather_summary}&rdquo;
                </p>

                {/* Recurring Motifs Row */}
                {weather.recurring_motifs && weather.recurring_motifs.length > 0 && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-serif text-mist flex items-center gap-1">
                      <Repeat className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Recurring anchors:</span>
                    </span>
                    {weather.recurring_motifs.map((motif, mIdx) => (
                      <span
                        key={mIdx}
                        className="px-2.5 py-1 rounded-lg text-xs font-serif border border-hairline bg-void/60 text-cloud/90 flex items-center gap-1.5"
                      >
                        <span className="text-cyan-300 font-medium">{motif.name}</span>
                        <span className="text-[10px] text-mist/70">×{motif.appearances}</span>
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Learned Symbol Lexicon Grid */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-hairline/60 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-lantern" />
                  <h3 className="text-sm font-serif font-medium text-cloud">
                    Learned Symbol Lexicon
                  </h3>
                </div>
                <span className="text-xs font-serif text-mist">
                  {lexicon.length} symbol{lexicon.length === 1 ? "" : "s"} tracked
                </span>
              </div>

              {lexicon.length === 0 ? (
                <div className="py-16 text-center space-y-4 max-w-md mx-auto border border-dashed border-hairline rounded-2xl p-8">
                  <Feather className="w-8 h-8 text-mist/40 mx-auto" />
                  <h4 className="text-sm font-serif text-cloud">No learned symbols yet</h4>
                  <p className="text-xs font-serif text-mist leading-relaxed">
                    As you approve dreams and click &ldquo;That resonates&rdquo; or &ldquo;That felt different&rdquo; in the Reflection phase, your personal symbol meanings will automatically learn and appear here.
                  </p>
                  <Link
                    href="/capture"
                    className="inline-block px-5 py-2 rounded-xl bg-lantern text-void font-semibold text-xs hover:bg-lantern-soft transition-colors"
                  >
                    Capture a Dream
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {lexicon.map((entry) => (
                    <article
                      key={entry.entity_id}
                      className="p-6 rounded-2xl border border-hairline bg-slate/20 hover:border-mist/40 hover:bg-slate/30 transition-all duration-300 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-serif font-medium text-cloud flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-lantern animate-pulse" />
                          <span>{entry.canonical_name}</span>
                        </h4>
                        <span className="text-[11px] font-serif text-mist/70">
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
                                <span className="text-cloud/90">{m.label}</span>
                                <span className="text-lantern font-medium">{pct}%</span>
                              </div>
                              {/* Probability Bar */}
                              <div className="h-1.5 rounded-full bg-void overflow-hidden border border-hairline/40">
                                <div
                                  className="h-full bg-gradient-to-r from-lantern/70 to-lantern rounded-full transition-all duration-500"
                                  style={{ width: `${Math.max(5, pct)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

