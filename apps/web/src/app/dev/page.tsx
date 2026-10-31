"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Play, ShieldAlert, Terminal, Wrench } from "lucide-react";
import { ArchCard } from "@/components/ui/arch-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SecondaryButton } from "@/components/ui/secondary-button";

export default function DevToolsPage() {
  const isDevEnabled =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_DEV_TOOLS === "true";

  if (!isDevEnabled) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6">
        <ArchCard isArchedTop isDoubleFrame className="p-8 text-center max-w-md space-y-4">
          <ShieldAlert className="w-10 h-10 text-dusk-rose mx-auto" />
          <h1 className="text-xl font-display text-text">Developer Sanctum Gated</h1>
          <p className="text-xs font-serif text-text-muted">
            Developer tools are currently disabled. Set NEXT_PUBLIC_DEV_TOOLS=true to access internal engine sandboxes.
          </p>
          <div className="pt-2">
            <Link href="/">
              <SecondaryButton>Return to Hearth</SecondaryButton>
            </Link>
          </div>
        </ArchCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text p-6 md:p-12 space-y-8 font-sans">
      <header className="flex items-center justify-between border-b border-hairline/60 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl border border-hairline text-text-muted hover:text-text hover:border-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-display text-text flex items-center gap-2">
              <Wrench className="w-5 h-5 text-accent" />
              <span>Developer Sandboxes & Engine Diagnostics</span>
            </h1>
            <p className="text-xs text-text-subtle font-mono">
              Gated by NEXT_PUBLIC_DEV_TOOLS
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        <ArchCard isDoubleFrame className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-accent">
            <Play className="w-5 h-5" />
            <h2 className="text-base font-display">Three.js Standalone Player Spike</h2>
          </div>
          <p className="text-xs font-serif text-text-muted leading-relaxed">
            The standalone Vite + Three.js spike running on port 5173. Tests raw cel-shading shaders, GLTF loading, and camera track transitions outside of the Next.js runtime.
          </p>
          <a
            href="http://localhost:5173"
            target="_blank"
            rel="noreferrer"
            className="inline-block"
          >
            <PrimaryButton icon={<Play className="w-4 h-4" />}>
              Launch Port 5173 Spike ↗
            </PrimaryButton>
          </a>
        </ArchCard>

        <ArchCard isDoubleFrame className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-accent">
            <Terminal className="w-5 h-5" />
            <h2 className="text-base font-display">Design System Catalog</h2>
          </div>
          <p className="text-xs font-serif text-text-muted leading-relaxed">
            Live interactive preview of base components (ArchCard, Buttons, Chips, HaloLoader, Toasts) across both Night and Dawn color modes with automated contrast verification.
          </p>
          <Link href="/design" className="inline-block">
            <SecondaryButton>
              Open /design Token Matrix →
            </SecondaryButton>
          </Link>
        </ArchCard>
      </div>
    </div>
  );
}
