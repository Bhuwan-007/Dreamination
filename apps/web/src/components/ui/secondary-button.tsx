"use client";

import React from "react";
import { motion, HTMLMotionProps } from "motion/react";

export interface SecondaryButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function SecondaryButton({
  children,
  icon,
  disabled,
  className = "",
  ...props
}: SecondaryButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-hairline bg-transparent hover:bg-accent/10 hover:border-accent/40 text-text-muted hover:text-text font-sans text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed motion-reduce:transform-none ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0 text-text-subtle group-hover:text-accent">{icon}</span>}
      <span>{children}</span>
    </motion.button>
  );
}

