"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  apiClient,
  InterpretationResponse,
  InterpretationThread,
} from "@/lib/api-client";
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Eye,
  HeartHandshake,
  History,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Send,
  HelpCircle,
  Feather,
  Sun,
} from "lucide-react";

export default function ReflectPage() {
  const params = useParams();
  const router = useRouter();
  const dreamId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<InterpretationResponse | null>(null);
  const [selectedThreadIndex, setSelectedThreadIndex] = useState<number | null>(null);
  const [feedbackState, setFeedbackState] = useState<"resonates" | "felt_different" | "none">("none");
  const [noteOpen, setNoteOpen] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [activeLensFilter, setActiveLensFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Try getting existing, or generate if none
      let data = await apiClient.getInterpretation(dreamId);
      if (!data || !data.threads || data.threads.length === 0) {
        data = await apiClient.generateInterpretation(dreamId);
      }
      setInterpretation(data);
      if (data.feedback && data.feedback !== "none") {
        setFeedbackState(data.feedback);
        setSelectedThreadIndex(data.selected_thread_index ?? 0);
        setFeedbackNote(data.feedback_note || "");
        setFeedbackSaved(true);
      } else if (data.threads && data.threads.length > 0) {
        setSelectedThreadIndex(0);
      }
    } catch (err: unknown) {
      console.error("Failed to load interpretation:", err);
      const message = err instanceof Error ? err.message : "Failed to load reflection threads.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [dreamId]);

  useEffect(() => {
    if (dreamId) {
      loadData();
    }
  }, [dreamId, loadData]);

  const handleFeedback = async (
    type: "resonates" | "felt_different",
    index: number,
    customNote?: string
  ) => {
    if (!interpretation) return;
    setIsSubmittingFeedback(true);
    setSelectedThreadIndex(index);
    setFeedbackState(type);

    try {
      const res = await apiClient.submitInterpretationFeedback(dreamId, {
        selected_thread_index: index,
        feedback: type,
        feedback_note: customNote !== undefined ? customNote : feedbackNote,
      });
      setInterpretation(res);
      setFeedbackSaved(true);
      if (type === "felt_different" && !customNote) {
        setNoteOpen(true);
      } else {
        setNoteOpen(false);
      }
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const getLensBadge = (lens: string) => {
    switch (lens.toLowerCase()) {
      case "cognitive_emotional":
        return {
          label: "Emotional Landscape",
          icon: <Compass className="w-3.5 h-3.5 text-lantern" />,
          color: "border-lantern/40 text-lantern bg-lantern/10",
        };
      case "jungian":
        return {
          label: "Archetypal & Symbolic",
          icon: <Eye className="w-3.5 h-3.5 text-amber-400" />,
          color: "border-amber-500/40 text-amber-300 bg-amber-500/10",
        };
      case "day_residue":
        return {
          label: "Day Residue & Memory",
          icon: <History className="w-3.5 h-3.5 text-cyan-400" />,
          color: "border-cyan-500/40 text-cyan-300 bg-cyan-500/10",
        };
      case "relational":
        return {
          label: "Relational & Encounters",
          icon: <HeartHandshake className="w-3.5 h-3.5 text-emerald-400" />,
          color: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
        };
      case "indic_philosophical":
      case "vedantic":
      case "dharmic":
        return {
          label: "Vedantic & Consciousness",
          icon: <Sun className="w-3.5 h-3.5 text-orange-400" />,
          color: "border-orange-500/40 text-orange-300 bg-orange-500/10",
        };
      default:
        return {
          label: "Reflective Thread",
          icon: <Feather className="w-3.5 h-3.5 text-mist" />,
          color: "border-mist/30 text-mist bg-slate/40",
        };
    }
  };

  const availableLenses = interpretation?.threads
    ? Array.from(new Set(interpretation.threads.map((t) => t.lens.toLowerCase())))
    : [];

  const filteredThreads = interpretation?.threads
    ? activeLensFilter === "all"
      ? interpretation.threads
      : interpretation.threads.filter((t) => t.lens.toLowerCase() === activeLensFilter)
    : [];

  return (
    <div className="relative min-h-screen bg-void text-cloud font-sans selection:bg-lantern/20 selection:text-lantern pb-32">
      {/* Background glow and subtle water ripple effect */}
      <div className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/30 via-void to-void" />

      {/* Top Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-void/80 border-b border-hairline px-6 py-4">
        <div className="max-w-[72ch] mx-auto flex items-center justify-between">
          <Link
            href={`/dreams/${dreamId}/review`}
            className="flex items-center gap-2 text-xs font-serif text-mist hover:text-cloud transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Story Review</span>
          </Link>

          <div className="text-center">
            <span className="text-xs uppercase tracking-widest text-lantern font-serif">
              Phase VI · Reflection
            </span>
            <h1 className="text-sm font-serif font-medium text-cloud">
              Possible Threads
            </h1>
          </div>

          <Link
            href={`/dreams/${dreamId}/theater`}
            className="text-xs font-serif text-mist hover:text-lantern transition-colors"
          >
            Skip reflection →
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-[72ch] mx-auto px-6 pt-10">
        {/* Humble philosophical preamble */}
        <div className="mb-10 text-center space-y-2">
          <p className="text-xs font-serif italic text-mist/90 max-w-[50ch] mx-auto leading-relaxed">
            &ldquo;These threads are gentle hypotheses, not verdicts. Every observation is grounded in your own exact words.&rdquo;
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-24 text-center space-y-6">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-lantern/30 animate-ping" />
              <div className="w-12 h-12 rounded-full border border-lantern/80 flex items-center justify-center bg-void/80 text-lantern animate-spin">
                <Sparkles className="w-6 h-6" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-serif font-medium text-cloud">
                Listening to the dream motifs...
              </h3>
              <p className="text-xs text-mist font-serif">
                Connecting emotional continuity with verbatim evidence.
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="py-16 text-center space-y-5 max-w-md mx-auto">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-serif leading-relaxed">
              {error}
            </div>
            <button
              onClick={() => loadData()}
              className="px-6 py-2.5 rounded-xl bg-lantern text-void font-semibold text-xs hover:bg-lantern-soft transition-all duration-300 shadow-lantern"
            >
              Try Listening Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && (!interpretation || !interpretation.threads || interpretation.threads.length === 0) && (
          <div className="py-16 text-center space-y-5 max-w-md mx-auto">
            <p className="text-sm font-serif text-mist">
              No reflection threads have been generated yet for this dream.
            </p>
            <button
              onClick={() => loadData()}
              className="px-6 py-2.5 rounded-xl bg-lantern text-void font-semibold text-xs hover:bg-lantern-soft transition-all duration-300 shadow-lantern"
            >
              Generate Reflection Threads
            </button>
          </div>
        )}

        {/* Lens Filter Switcher */}
        {!isLoading && !error && interpretation && interpretation.threads && interpretation.threads.length > 0 && (
          <div className="mb-8">
            <div className="text-[11px] uppercase tracking-wider text-mist/70 font-serif text-center mb-3">
              Filter By Perspective
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setActiveLensFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-serif transition-all duration-200 flex items-center gap-1.5 ${
                  activeLensFilter === "all"
                    ? "bg-lantern text-void font-semibold shadow-lantern"
                    : "border border-hairline bg-slate/30 text-mist hover:text-cloud hover:border-mist/40"
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>All ({interpretation.threads.length})</span>
              </button>

              {availableLenses.map((lens) => {
                const badge = getLensBadge(lens);
                const isActive = activeLensFilter === lens;
                const count = interpretation.threads.filter((t) => t.lens.toLowerCase() === lens).length;

                return (
                  <button
                    key={lens}
                    onClick={() => setActiveLensFilter(lens)}
                    className={`px-3 py-1.5 rounded-full text-xs font-serif transition-all duration-200 flex items-center gap-1.5 border ${
                      isActive
                        ? `${badge.color} ring-1 ring-lantern/40 font-semibold shadow-sm`
                        : "border-hairline bg-slate/30 text-mist hover:text-cloud hover:border-mist/40"
                    }`}
                  >
                    {badge.icon}
                    <span>{badge.label}</span>
                    {count > 1 && <span className="text-[10px] opacity-70">({count})</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Thread Cards */}
        {!isLoading && !error && interpretation && interpretation.threads && interpretation.threads.length > 0 && (
          <div className="space-y-8">
            {filteredThreads.map((thread: InterpretationThread) => {
              const originalIdx = interpretation.threads.indexOf(thread);
              const badge = getLensBadge(thread.lens);
              const isSelected = selectedThreadIndex === originalIdx;

              return (
                <article
                  key={originalIdx}
                  className={`relative p-6 sm:p-8 rounded-2xl border transition-all duration-300 ${
                    isSelected
                      ? "border-lantern/80 bg-slate/50 shadow-lantern ring-1 ring-lantern/30"
                      : "border-hairline bg-slate/20 hover:border-mist/40 hover:bg-slate/30"
                  }`}
                >
                  {/* Lens Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-serif border ${badge.color}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>

                    <span className="text-[11px] font-serif text-mist/60">
                      Thread {originalIdx + 1} of {interpretation.threads.length}
                    </span>
                  </div>

                  {/* Thread Title & Reading */}
                  <div className="space-y-3 mb-6">
                    <h2 className="text-lg sm:text-xl font-serif font-medium text-cloud">
                      {thread.title}
                    </h2>
                    <p className="text-sm sm:text-base font-serif text-cloud/90 leading-relaxed font-light">
                      {thread.reading}
                    </p>
                  </div>

                  {/* Verbatim Evidence Section */}
                  {thread.evidence && thread.evidence.length > 0 && (
                    <div className="mb-6 p-4 rounded-xl bg-void/60 border border-hairline/60 space-y-3">
                      <div className="text-[11px] uppercase tracking-wider text-mist font-serif flex items-center gap-1.5">
                        <Feather className="w-3.5 h-3.5 text-lantern" />
                        <span>Verbatim Evidence From Your Notes</span>
                      </div>
                      <div className="space-y-2.5">
                        {thread.evidence.map((ev, evIdx) => (
                          <div key={evIdx} className="space-y-1">
                            <blockquote className="text-xs sm:text-sm font-serif italic text-lantern border-l-2 border-lantern/60 pl-3">
                              &ldquo;{ev.quote_from_user}&rdquo;
                            </blockquote>
                            <p className="text-[11px] font-serif text-mist/80 pl-3">
                              {ev.why_it_matters}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Symbols & Waking Questions Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {/* Symbols */}
                    {thread.symbols && thread.symbols.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-void/40 border border-hairline/40 space-y-1.5">
                        <div className="text-[11px] uppercase tracking-wider text-mist font-serif">
                          Personal Symbols
                        </div>
                        <ul className="space-y-1.5">
                          {thread.symbols.map((sym, sIdx) => (
                            <li key={sIdx} className="text-xs font-serif text-cloud/90">
                              <span className="font-semibold text-lantern">{sym.name}:</span>{" "}
                              <span className="text-mist">{sym.possible_meaning}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Waking Questions */}
                    {thread.waking_life_questions && thread.waking_life_questions.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-void/40 border border-hairline/40 space-y-1.5">
                        <div className="text-[11px] uppercase tracking-wider text-mist font-serif flex items-center gap-1">
                          <HelpCircle className="w-3 h-3 text-cyan-400" />
                          <span>For Reflection</span>
                        </div>
                        <ul className="space-y-1.5">
                          {thread.waking_life_questions.map((q, qIdx) => (
                            <li key={qIdx} className="text-xs font-serif italic text-mist/90">
                              &ldquo;{q}&rdquo;
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Resonance & Feedback Action Bar */}
                  <div className="pt-4 border-t border-hairline/60 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {/* Resonates Button */}
                      <button
                        onClick={() => handleFeedback("resonates", originalIdx)}
                        disabled={isSubmittingFeedback}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-serif transition-all duration-200 flex items-center gap-1.5 ${
                          isSelected && feedbackState === "resonates"
                            ? "bg-lantern text-void font-semibold shadow-lantern"
                            : "border border-hairline bg-void text-mist hover:text-cloud hover:border-lantern/60"
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>That resonates</span>
                      </button>

                      {/* Felt Different Button */}
                      <button
                        onClick={() => handleFeedback("felt_different", originalIdx)}
                        disabled={isSubmittingFeedback}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-serif transition-all duration-200 flex items-center gap-1.5 ${
                          isSelected && feedbackState === "felt_different"
                            ? "bg-mist/30 text-cloud border border-mist/50"
                            : "border border-hairline bg-void text-mist hover:text-cloud hover:border-mist"
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>That felt different</span>
                      </button>
                    </div>

                    {isSelected && feedbackSaved && (
                      <div className="flex items-center gap-1.5 text-xs text-leaf font-serif animate-fade-in">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Resonance recorded</span>
                      </div>
                    )}
                  </div>

                  {/* Drawer for 'Felt Different' Note */}
                  {isSelected && noteOpen && (
                    <div className="mt-4 pt-4 border-t border-hairline/60 space-y-3">
                      <label className="text-xs font-serif text-mist block">
                        How did this dream or symbol feel different to you? (This trains your personal symbol lexicon)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={feedbackNote}
                          onChange={(e) => setFeedbackNote(e.target.value)}
                          placeholder="e.g., In this dream, the water felt cold and suffocating rather than peaceful..."
                          className="flex-1 bg-void border border-hairline rounded-lg px-3 py-1.5 text-xs font-serif text-cloud focus:outline-none focus:border-lantern"
                        />
                        <button
                          onClick={() => handleFeedback("felt_different", originalIdx, feedbackNote)}
                          className="px-3 py-1.5 rounded-lg bg-lantern text-void font-semibold text-xs flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>Save</span>
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}

            {/* Bottom Stepping Forward Action */}
            <div className="pt-8 text-center space-y-4">
              <Link
                href={`/dreams/${dreamId}/theater`}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-lantern text-void font-semibold text-sm hover:bg-lantern-soft transition-all duration-300 shadow-lantern"
              >
                <span>Step Into 3D Theater</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <div>
                <Link
                  href="/capture"
                  className="text-xs font-serif text-mist hover:text-cloud transition-colors"
                >
                  Return to Journal Capture
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

