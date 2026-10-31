"use client";

import React from "react";
import { motion, HTMLMotionProps } from "motion/react";

export interface PrimaryButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export function PrimaryButton({
  children,
  icon,
  isLoading,
  disabled,
  className = "",
  ...props
}: PrimaryButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled || isLoading ? 1 : 1.01 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-accent text-bg font-sans font-medium text-sm tracking-wide shadow-lantern hover:shadow-[0_0_24px_rgba(226,184,102,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed transition-colors motion-reduce:transform-none ${className}`}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-bg motion-reduce:animate-none"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </motion.button>
  );
}

