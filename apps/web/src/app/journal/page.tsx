"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Compass,
  Calendar,
  Sparkles,
  ArrowRight,
  BookOpen,
  Clapperboard,
  Layers,
  Heart,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { ArchCard } from "@/components/ui/arch-card";
import { Chip } from "@/components/ui/chip";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { HaloLoader } from "@/components/ui/halo-loader";
import { PageBackdrop } from "@/components/ui/page-backdrop";

interface DreamItem {
  id: string;
  captured_at: string;
  mood_on_waking: string | null;
  status: string;
  created_at?: string;
  title?: string;
  notes_snippet?: string;
}

export default function JournalPage() {
  const [dreams, setDreams] = useState<DreamItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDreams() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiClient.listDreams();
        setDreams(data);
      } catch (err: any) {
        console.error("Failed to load journal dreams:", err);
        setError("The tide took that one. Unable to load dreams.");
      } finally {
        setIsLoading(false);
      }
    }

    loadDreams();
  }, []);

  const getResumeUrl = (dream: DreamItem) => {
    switch (dream.status) {
      case "captured":
        return `/dreams/${dream.id}/review`;
      case "reconstructed":
        return `/dreams/${dream.id}/reflect`;
      case "interpreted":
      case "approved":
        return `/dreams/${dream.id}/theater`;
      default:
        return `/dreams/${dream.id}/review`;
    }
  };

  const getStepActionLabel = (status: string) => {
    switch (status) {
      case "captured":
        return "Weave";
      case "reconstructed":
        return "Reflect";
      case "interpreted":
      case "approved":
        return "Watch";
      default:
        return "Continue";
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Morning Memory";
    }
  };

  return (
    <div data-theme="night" className="min-h-screen bg-bg text-text">
      <AppShell>
        <PageBackdrop
          src={dreams.length === 0 ? "/art/empty-book.webp" : "/art/fragments.webp"}
          alt="Journal memories backdrop"
          opacity={0.68}
        />
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        {/* Page Title & Vision */}
        <header className="space-y-3 pb-6 border-b border-hairline">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-accent">
            <BookOpen className="w-4 h-4" />
            <span>The Dream Journal</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-medium text-text">
            Your Constellation of Memories
          </h1>
          <p className="text-sm font-serif text-text-muted max-w-2xl leading-relaxed">
            Every fragment you whispered on waking, woven into stories, reflections, and 3D animated performances.
          </p>
        </header>

        {/* Loading State */}
        {isLoading && (
          <div className="py-20">
            <HaloLoader stageText="Opening the vault of memories..." />
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <ArchCard className="p-8 text-center space-y-4 max-w-md mx-auto">
            <p className="text-sm text-dusk-rose font-serif">{error}</p>
            <SecondaryButton onClick={() => window.location.reload()}>
              Try Again
            </SecondaryButton>
          </ArchCard>
        )}

        {/* Empty State */}
        {!isLoading && !error && dreams.length === 0 && (
          <ArchCard isDoubleFrame isArchedTop className="p-12 text-center space-y-6 max-w-lg mx-auto my-12">
            <div className="w-14 h-14 mx-auto rounded-full border border-accent/40 bg-accent/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-accent animate-pulse motion-reduce:animate-none" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-display text-text">No dreams yet. The door is open.</h2>
              <p className="text-xs font-serif text-text-muted leading-relaxed">
                Capture the broken fragments when you wake tomorrow. Even a colour or a single phrase will do.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/capture">
                <PrimaryButton icon={<ArrowRight className="w-4 h-4" />}>
                  Enter Capture Sanctum
                </PrimaryButton>
              </Link>
            </div>
          </ArchCard>
        )}

        {/* Dream Grid (1/2/3 columns responsive) */}
        {!isLoading && !error && dreams.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dreams.map((dream) => {
              const resumeUrl = getResumeUrl(dream);
              const actionLabel = getStepActionLabel(dream.status);

              return (
                <ArchCard
                  key={dream.id}
                  isInteractive
                  isDoubleFrame
                  className="p-6 flex flex-col justify-between gap-6 group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-mono text-text-subtle">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(dream.captured_at)}</span>
                      </span>
                      <Chip variant={dream.status === "approved" ? "lantern" : "mist"}>
                        {dream.status.replace("_", " ")}
                      </Chip>
                    </div>

                    <div className="space-y-1.5">
                      {dream.title ? (
                        <h3 className="text-lg font-serif font-medium text-text group-hover:text-accent transition-colors line-clamp-2">
                          {dream.title}
                        </h3>
                      ) : dream.notes_snippet ? (
                        <h3 className="text-base font-serif italic text-text-muted group-hover:text-accent transition-colors line-clamp-2">
                          &ldquo;{dream.notes_snippet}&rdquo;
                        </h3>
                      ) : (
                        <h3 className="text-lg font-serif font-medium text-text group-hover:text-accent transition-colors line-clamp-2">
                          Untitled Dream Memory
                        </h3>
                      )}

                      {dream.mood_on_waking && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <Heart className="w-3 h-3 text-accent" />
                          <span className="text-xs font-serif italic text-text-muted capitalize">
                            Waking mood: {dream.mood_on_waking}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-hairline/60 flex items-center justify-between gap-4">
                    <span className="text-xs font-serif text-text-subtle whitespace-nowrap">
                      Step {dream.status === "captured" ? "1 · Capture" : dream.status === "reconstructed" ? "2 · Weave" : dream.status === "interpreted" ? "3 · Reflect" : "4 · Watch"}
                    </span>
                    <Link href={resumeUrl}>
                      <SecondaryButton icon={<ArrowRight className="w-3.5 h-3.5" />}>
                        {actionLabel}
                      </SecondaryButton>
                    </Link>
                  </div>
                </ArchCard>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
    </div>
  );
}

