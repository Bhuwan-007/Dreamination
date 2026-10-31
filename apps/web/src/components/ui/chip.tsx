"use client";

import React from "react";

export type ChipVariant = "lantern" | "lake" | "leaf" | "sage" | "dusk-rose" | "mist";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: ChipVariant;
  icon?: React.ReactNode;
}

export function Chip({
  children,
  variant = "mist",
  icon,
  className = "",
  ...props
}: ChipProps) {
  const variantStyles: Record<ChipVariant, string> = {
    lantern: "bg-accent/10 border-accent/30 text-accent",
    lake: "bg-link/10 border-link/30 text-link",
    leaf: "bg-success/10 border-success/30 text-success",
    sage: "bg-text-subtle/10 border-text-subtle/30 text-text-subtle",
    "dusk-rose": "bg-dusk-rose/10 border-dusk-rose/30 text-dusk-rose",
    mist: "bg-surface-raised border-hairline text-text-muted",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-sans tracking-wide ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
