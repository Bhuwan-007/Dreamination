"use client";

import React from "react";
import Image from "next/image";

export interface PageBackdropProps {
  src: string;
  alt?: string;
  opacity?: number; // 0.35 to 0.55 per Section 10 / Section 12
  scrim?: "default" | "heavy" | "subtle";
  priority?: boolean;
  className?: string;
}

export function PageBackdrop({
  src,
  alt = "Atmospheric dream artwork",
  opacity = 0.42,
  scrim = "default",
  priority = false,
  className = "",
}: PageBackdropProps) {
  const scrimOpacityClass =
    scrim === "heavy"
      ? "bg-bg/85"
      : scrim === "subtle"
      ? "bg-bg/50"
      : "bg-bg/70";

  return (
    <div
      className={`fixed inset-0 pointer-events-none -z-10 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* 1. Underlying Art Image */}
      <Image
        src={src}
        alt={alt}
        fill
        sizes="100vw"
        priority={priority}
        className="object-cover object-center"
        style={{ opacity: Math.min(Math.max(opacity, 0.35), 0.55) }}
      />

      {/* 2. Dark Scrim Layer for text contrast >= 4.5:1 */}
      <div className={`absolute inset-0 ${scrimOpacityClass}`} />

      {/* 3. Gradient edge darkening and vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--bg)_95%)]" />
    </div>
  );
}

