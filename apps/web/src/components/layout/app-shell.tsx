"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  BookOpen,
  Users,
  Sparkles,
  Settings,
  Mic,
  Moon,
  Sun,
  Shield,
  Film,
} from "lucide-react";
import { TravelerLogo } from "@/components/ui/traveler-logo";
import { Tooltip } from "@/components/ui/tooltip";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"night" | "dawn">("night");
  const [calmMode, setCalmMode] = useState<boolean>(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const h = new Date().getHours();
    const autoTheme = h >= 19 || h < 6 ? "night" : "dawn";
    const active = savedTheme && savedTheme !== "auto" ? (savedTheme as "night" | "dawn") : autoTheme;
    setTheme(active);

    const savedCalm = localStorage.getItem("calm_mode") === "true";
    setCalmMode(savedCalm);
  }, []);

  const toggleTheme = () => {
    const next = theme === "night" ? "dawn" : "night";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.dataset.theme = next;
  };

  const navItems = [
    { label: "Capture", href: "/capture", icon: Mic },
    { label: "Journal", href: "/journal", icon: BookOpen },
    { label: "Cast", href: "/cast", icon: Users, isSoon: true },
    { label: "Lexicon", href: "/lexicon", icon: Sparkles },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  // Dream step indicators on dream routes
  const isDreamFlow = pathname.startsWith("/dreams/") || pathname === "/capture";
  let activeStep = 0;
  if (pathname === "/capture") activeStep = 1;
  else if (pathname.includes("/review")) activeStep = 2;
  else if (pathname.includes("/reflect")) activeStep = 3;
  else if (pathname.includes("/theater")) activeStep = 4;

  const steps = [
    { num: 1, name: "Capture", path: "/capture" },
    { num: 2, name: "Weave", path: "review" },
    { num: 3, name: "Reflect", path: "reflect" },
    { num: 4, name: "Watch", path: "theater" },
  ];

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col md:flex-row pb-20 md:pb-0">
      {/* 1. Desktop Left Arch Rail */}
      <aside className="hidden md:flex flex-col items-center justify-between w-20 py-6 border-r border-hairline bg-surface/85 backdrop-blur-md z-40 shrink-0 sticky top-0 h-screen">
        <div className="flex flex-col items-center gap-8">
          <Tooltip content="The Dream Machine" position="right">
            <Link
              href="/"
              className="p-2 rounded-2xl hover:border hover:border-hairline hover:bg-surface-raised transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg block"
              aria-label="The Dream Machine Home"
            >
              <TravelerLogo size={36} />
            </Link>
          </Tooltip>

          <nav className="flex flex-col items-center gap-4" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

              if (item.isSoon) {
                return (
                  <Tooltip key={item.label} content={`${item.label} (Arriving soon)`} position="right">
                    <div
                      className="p-3 rounded-2xl border border-transparent text-text-subtle/50 cursor-not-allowed flex items-center justify-center"
                      aria-label={`${item.label} (Arriving soon)`}
                      role="button"
                      aria-disabled="true"
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                  </Tooltip>
                );
              }

              return (
                <Tooltip key={item.label} content={item.label} position="right">
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    className={`relative p-3 rounded-2xl transition-all duration-200 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                      isActive
                        ? "bg-accent/15 border border-accent/50 text-accent shadow-lantern-sm"
                        : "border border-transparent text-text-muted hover:text-text hover:border-hairline hover:bg-surface-raised"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {isActive && (
                      <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
                    )}
                  </Link>
                </Tooltip>
              );
            })}
          </nav>
        </div>

        {/* Bottom Rail Utilities */}
        <div className="flex flex-col items-center gap-3">
          <Tooltip content={`Switch to ${theme === "night" ? "Dawn" : "Night"} theme`} position="right">
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "night" ? "Dawn" : "Night"} theme`}
              className="p-2.5 rounded-full border border-hairline text-text-muted hover:text-text hover:border-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              {theme === "night" ? <Moon className="w-4 h-4 text-accent" /> : <Sun className="w-4 h-4 text-accent" />}
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Step Indicator Bar on Dream Flow Screens */}
        {isDreamFlow && activeStep > 0 && (
          <div className="w-full border-b border-hairline bg-surface/40 backdrop-blur-md px-6 py-2.5 z-30">
            <div className="max-w-4xl mx-auto flex items-center justify-between text-xs font-serif">
              <div className="flex items-center gap-3 sm:gap-6">
                {steps.map((s, idx) => (
                  <React.Fragment key={s.num}>
                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        activeStep === s.num
                          ? "text-accent font-semibold"
                          : activeStep > s.num
                          ? "text-text-muted"
                          : "text-text-subtle"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                          activeStep === s.num
                            ? "bg-accent text-bg"
                            : activeStep > s.num
                            ? "border border-hairline bg-surface-raised text-text-muted"
                            : "border border-hairline/40 text-text-subtle"
                        }`}
                      >
                        {s.num}
                      </span>
                      <span>{s.name}</span>
                    </div>
                    {idx < steps.length - 1 && (
                      <span className="text-hairline select-none">·</span>
                    )}
                  </React.Fragment>
                ))}
              </div>

              <div className="hidden sm:flex items-center gap-2 text-text-subtle text-[11px] font-mono">
                <Shield className="w-3.5 h-3.5 text-accent" />
                <span>Zero-Retention Private Vault</span>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1">{children}</main>
      </div>

      {/* 3. Mobile Fixed Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-hairline px-4 py-2 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          if (item.isSoon) {
            return (
              <div
                key={item.label}
                className="flex flex-col items-center gap-1 p-2 text-text-subtle/50 opacity-50 cursor-not-allowed"
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-sans">Soon</span>
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.label}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
                isActive ? "text-accent font-medium" : "text-text-muted hover:text-text"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-sans">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

