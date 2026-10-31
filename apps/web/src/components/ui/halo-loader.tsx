"use client";

import React from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

export interface HaloLoaderProps {
  stageText?: string;
  subText?: string;
  className?: string;
}

export function HaloLoader({
  stageText = "Gathering the fragments...",
  subText,
  className = "",
}: HaloLoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-8 text-center ${className}`}>
      <div className="relative w-16 h-16 flex items-center justify-center">
        {/* Pulsing outer aura */}
        <div className="absolute inset-0 rounded-full bg-accent/10 blur-md animate-pulse motion-reduce:animate-none" />

        {/* Orbiting ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="w-14 h-14 rounded-full border border-dashed border-accent/40 flex items-start justify-center motion-reduce:transform-none"
        >
          {/* Orbiting star */}
          <div className="w-2 h-2 -mt-1 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
        </motion.div>

        {/* Inner static core */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-accent animate-pulse motion-reduce:animate-none" />
        </div>
      </div>

      <div className="space-y-1">
        {stageText && (
          <p className="text-sm font-serif italic text-text-muted tracking-wide animate-pulse motion-reduce:animate-none">
            {stageText}
          </p>
        )}
        {subText && (
          <p className="text-xs font-serif text-text-subtle">
            {subText}
          </p>
        )}
      </div>
    </div>
  );
}
