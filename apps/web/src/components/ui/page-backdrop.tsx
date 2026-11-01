import React from "react";
import Image from "next/image";

interface PageBackdropProps {
  src: string;
  alt: string;
  opacity?: number; // 0.60 to 0.75
  priority?: boolean;
  headerBandOnly?: boolean;
  className?: string;
}

/**
 * Fixed art layer reusing project watercolor artworks across non-landing pages.
 * Displays at 60-75% opacity, darkened only by edge gradients (never a flat dark overlay),
 * object-cover, and locked strictly to Night palette to prevent Dawn leaks over art.
 */
export function PageBackdrop({
  src,
  alt,
  opacity = 0.68,
  priority = false,
  headerBandOnly = false,
  className = "",
}: PageBackdropProps) {
  const clampedOpacity = Math.max(0.6, Math.min(0.75, opacity));

  if (headerBandOnly) {
    return (
      <div
        data-theme="night"
        className={`absolute top-0 left-0 right-0 h-64 sm:h-72 pointer-events-none select-none z-0 overflow-hidden ${className}`}
        aria-hidden="true"
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="100vw"
          className="object-cover object-center"
          style={{ opacity: clampedOpacity }}
        />
        {/* Edge gradients to blend smoothly into page content */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#090D11] via-[#090D11]/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#090D11] via-[#090D11]/70 to-transparent" />
      </div>
    );
  }

  return (
    <div
      data-theme="night"
      className={`fixed inset-0 pointer-events-none select-none z-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="100vw"
        className="object-cover object-center"
        style={{ opacity: clampedOpacity }}
      />
      {/* Top and bottom edge gradients - no flat overlay */}
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#090D11] via-[#090D11]/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#090D11] via-[#090D11]/75 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#090D11]/40 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#090D11]/40 to-transparent" />
    </div>
  );
}
