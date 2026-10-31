"use client";

import React from "react";

export function TravelerLogo({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="The Dream Machine Logo: The Traveler"
      className={`shrink-0 transition-transform duration-300 hover:scale-105 motion-reduce:transform-none ${className}`}
    >
      <defs>
        <linearGradient id="traveler-light" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="var(--accent-soft)" stopOpacity="0.95" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {/* Light pouring through the arch */}
      <path d="M16 56V27a16 16 0 0 1 32 0v29z" fill="url(#traveler-light)" />
      {/* Sun / Halo ring */}
      <circle cx="34" cy="24" r="6" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      {/* Floating island */}
      <path d="M26 33h16l-3 3h-10z" fill="var(--accent)" opacity="0.8" />
      {/* Traveler silhouette head & body */}
      <circle cx="32" cy="43" r="2.6" fill="var(--bg)" />
      <path d="M27.5 56c0-7 2-10.5 4.5-10.5s4.5 3.5 4.5 10.5z" fill="var(--bg)" />
      {/* Arch doorway outline */}
      <path d="M16 56V27a16 16 0 0 1 32 0v29" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      {/* Door leaf slightly ajar */}
      <path d="M16 56V27l-6 3v22z" fill="var(--accent)" opacity="0.55" />
      {/* Threshold step */}
      <path d="M8 56h48" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

