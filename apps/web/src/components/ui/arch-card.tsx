"use client";

import React from "react";

export interface ArchCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  isDoubleFrame?: boolean;
  isInteractive?: boolean;
  isArchedTop?: boolean;
  glow?: boolean;
}

export function ArchCard({
  children,
  isDoubleFrame = false,
  isInteractive = false,
  isArchedTop = false,
  glow = false,
  className = "",
  ...props
}: ArchCardProps) {
  const shapeClass = isArchedTop
    ? "rounded-t-[2.75rem] rounded-b-2xl"
    : "rounded-2xl";

  return (
    <div
      className={`relative bg-surface text-text border border-hairline transition-all duration-300 ${
        glow
          ? "shadow-[0_0_0_1px_var(--hairline),0_12px_48px_-12px_rgba(226,184,102,0.18)] ring-1 ring-hairline"
          : "shadow-[0_0_0_1px_var(--hairline),0_12px_48px_-12px_rgba(226,184,102,0.14)]"
      } ${
        isInteractive
          ? "hover:border-hairline/90 hover:shadow-[0_0_0_1px_var(--hairline),0_16px_48px_-12px_rgba(226,184,102,0.18)] cursor-pointer"
          : ""
      } ${shapeClass} ${className}`}
      {...props}
    >
      {isDoubleFrame && (
        <div
          className={`pointer-events-none absolute inset-1.5 border border-hairline/60 ${
            isArchedTop ? "rounded-t-[2.35rem] rounded-b-[0.8rem]" : "rounded-xl"
          }`}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
