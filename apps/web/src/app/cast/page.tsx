"use client";

import React from "react";
import Link from "next/link";
import { Users, Sparkles, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ArchCard } from "@/components/ui/arch-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { PageBackdrop } from "@/components/ui/page-backdrop";

export default function CastPage() {
  return (
    <div data-theme="night" className="min-h-screen bg-bg text-text">
      <AppShell>
        <PageBackdrop src="/art/portal-window.webp" alt="The Portal Window Cast backdrop" opacity={0.68} />
        <div className="max-w-3xl mx-auto px-6 py-16 text-center space-y-8">
        <ArchCard isDoubleFrame isArchedTop className="p-12 space-y-6 max-w-lg mx-auto">
          <div className="w-16 h-16 mx-auto rounded-full border border-accent/40 bg-accent/10 flex items-center justify-center">
            <Users className="w-7 h-7 text-accent animate-pulse motion-reduce:animate-none" />
          </div>

          <div className="space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-accent px-2.5 py-1 rounded-full bg-accent/10 border border-accent/30">
              Arriving in Phase 9.2
            </span>
            <h1 className="text-2xl font-display font-medium text-text">
              The Persistent Dream Cast
            </h1>
            <p className="text-xs sm:text-sm font-serif text-text-muted leading-relaxed">
              When recurring figures, companions, and shadow travelers appear across your dreams, they will be given persistent 3D avatars, outfit lineages, and face visibility settings here.
            </p>
          </div>

          <div className="pt-4 flex justify-center">
            <Link href="/journal">
              <PrimaryButton icon={<ArrowRight className="w-4 h-4" />}>
                Explore Journal Memories
              </PrimaryButton>
            </Link>
          </div>
        </ArchCard>
      </div>
    </AppShell>
    </div>
  );
}

