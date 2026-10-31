"use client";

import React, { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Moon,
  Sun,
  Clock,
  Volume2,
  VolumeX,
  Wind,
  Palette,
  Shield,
  Download,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ArchCard } from "@/components/ui/arch-card";
import { PageBackdrop } from "@/components/ui/page-backdrop";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { useToast } from "@/components/ui/toast";
import { apiClient } from "@/lib/api-client";

export default function SettingsPage() {
  const { toast, successToast, errorToast } = useToast();

  const [themeMode, setThemeMode] = useState<"auto" | "night" | "dawn">("auto");
  const [calmMode, setCalmMode] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") as "auto" | "night" | "dawn") || "auto";
    setThemeMode(savedTheme);

    const savedCalm = localStorage.getItem("calm_mode") === "true";
    setCalmMode(savedCalm);

    const savedSound = localStorage.getItem("sound_enabled") === "true";
    setSoundEnabled(savedSound);
  }, []);

  const handleThemeChange = (newTheme: "auto" | "night" | "dawn") => {
    setThemeMode(newTheme);
    localStorage.setItem("theme", newTheme);

    if (newTheme === "auto") {
      const h = new Date().getHours();
      const autoVal = h >= 19 || h < 6 ? "night" : "dawn";
      document.documentElement.dataset.theme = autoVal;
    } else {
      document.documentElement.dataset.theme = newTheme;
    }
    successToast(`Theme set to ${newTheme.toUpperCase()}`);
  };

  const handleCalmToggle = () => {
    const next = !calmMode;
    setCalmMode(next);
    localStorage.setItem("calm_mode", String(next));
    if (next) {
      document.body.classList.add("calm-mode");
      toast("Calm mode active: particle trails and animations softened.");
    } else {
      document.body.classList.remove("calm-mode");
      toast("Calm mode deactivated.");
    }
  };

  const handleSoundToggle = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("sound_enabled", String(next));
    toast(next ? "Synthesized soundscapes enabled." : "Soundscapes muted.");
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      let token = apiClient.getToken();
      if (!token) token = await apiClient.ensureAuthenticated();

      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("http://localhost:8000/auth/delete-account", {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        throw new Error("Failed to delete account");
      }

      apiClient.setToken(null);
      localStorage.clear();
      sessionStorage.clear();
      successToast("All dream data permanently hard-deleted.");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (err: any) {
      console.error("Delete failed:", err);
      errorToast("Unable to delete account at this time.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <AppShell>
      <PageBackdrop src="/art/vault.webp" opacity={0.42} />
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-12">
        <header className="space-y-3 pb-6 border-b border-hairline">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-accent">
            <SettingsIcon className="w-4 h-4" />
            <span>Preferences & Data</span>
          </div>
          <h1 className="text-3xl font-display font-medium text-text">
            Settings & The Vault
          </h1>
          <p className="text-xs sm:text-sm font-serif text-text-muted leading-relaxed">
            Customize your atmosphere, manage motion comfort, and inspect your private zero-retention vault.
          </p>
        </header>

        {/* 1. Theme Setting */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-display text-text">Theme & Atmosphere</h2>
            <p className="text-xs font-serif text-text-muted">
              Auto follows your local sunrise and sunset; Night is deep forest void; Dawn is cotton paper.
            </p>
          </div>

          <ArchCard className="p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-accent" />
              <div>
                <div className="text-sm font-serif text-text">Color Mode</div>
                <div className="text-xs text-text-subtle font-sans capitalize">Current: {themeMode}</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-full border border-hairline bg-surface-raised">
              <button
                onClick={() => handleThemeChange("auto")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans transition-colors ${
                  themeMode === "auto" ? "bg-accent text-bg font-semibold shadow-lantern-sm" : "text-text-muted hover:text-text"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Auto</span>
              </button>
              <button
                onClick={() => handleThemeChange("night")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans transition-colors ${
                  themeMode === "night" ? "bg-accent text-bg font-semibold shadow-lantern-sm" : "text-text-muted hover:text-text"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Night</span>
              </button>
              <button
                onClick={() => handleThemeChange("dawn")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans transition-colors ${
                  themeMode === "dawn" ? "bg-accent text-bg font-semibold shadow-lantern-sm" : "text-text-muted hover:text-text"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Dawn</span>
              </button>
            </div>
          </ArchCard>
        </section>

        {/* 2. Calm Mode & Sound */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-display text-text">Comfort & Sensory Motion</h2>
            <p className="text-xs font-serif text-text-muted">
              Calm mode disables floating ember particles, cursor trails, and water distortion.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ArchCard className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Wind className="w-5 h-5 text-accent" />
                <div>
                  <div className="text-sm font-serif text-text">Calm Mode</div>
                  <div className="text-xs text-text-subtle">Reduced motion & quiet visual state</div>
                </div>
              </div>
              <button
                onClick={handleCalmToggle}
                className={`w-12 h-6 rounded-full transition-colors relative border border-hairline ${
                  calmMode ? "bg-accent" : "bg-surface-raised"
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-bg absolute top-0.5 transition-transform ${
                    calmMode ? "right-1" : "left-1"
                  }`}
                />
              </button>
            </ArchCard>

            <ArchCard className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5 text-accent" />
                ) : (
                  <VolumeX className="w-5 h-5 text-text-subtle" />
                )}
                <div>
                  <div className="text-sm font-serif text-text">Soundscape Audio</div>
                  <div className="text-xs text-text-subtle">Synthesized Web Audio chimes</div>
                </div>
              </div>
              <button
                onClick={handleSoundToggle}
                className={`w-12 h-6 rounded-full transition-colors relative border border-hairline ${
                  soundEnabled ? "bg-accent" : "bg-surface-raised"
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-bg absolute top-0.5 transition-transform ${
                    soundEnabled ? "right-1" : "left-1"
                  }`}
                />
              </button>
            </ArchCard>
          </div>
        </section>

        {/* 3. Style Presets (Phase 9.3 Placeholder) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-display text-text">Visual Style Presets</h2>
              <p className="text-xs font-serif text-text-muted">
                Lock one persistent cel-shaded art style for your 3D dream films.
              </p>
            </div>
            <span className="text-xs font-mono text-accent uppercase tracking-wider px-2 py-0.5 rounded bg-accent/10 border border-accent/30">
              Phase 9.3
            </span>
          </div>

          <ArchCard className="p-8 text-center space-y-3 border-dashed">
            <Palette className="w-6 h-6 text-text-subtle mx-auto" />
            <p className="text-xs font-serif text-text-muted leading-relaxed">
              Style Presets (Nocturne Halo, Lantern Vale, Monolith Falls, Portal Meadow) with live 3-scene test previews arrive in Phase 9.3.
            </p>
          </ArchCard>
        </section>

        {/* 4. Privacy Vault (Export / Delete) */}
        <section className="space-y-4 pt-4 border-t border-hairline">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" />
              <h2 className="text-base font-display text-text">The Privacy Vault</h2>
            </div>
            <p className="text-xs font-serif text-text-muted">
              Dreams are encrypted at rest with AES-GCM and never logged. You own all data.
            </p>
          </div>

          <div className="space-y-3">
            <ArchCard className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="text-sm font-serif text-text">Export All Dream Data</div>
                <div className="text-xs text-text-subtle">
                  Complete JSON stories, reflections, audio transcripts, and director scripts.
                </div>
              </div>
              <SecondaryButton
                disabled
                icon={<Download className="w-4 h-4" />}
                title="Full JSON & media zip export arriving in Phase 12"
              >
                Export Vault (Phase 12)
              </SecondaryButton>
            </ArchCard>

            <ArchCard className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-dusk-rose/30">
              <div>
                <div className="text-sm font-serif text-dusk-rose">Permanently Delete Account</div>
                <div className="text-xs text-text-subtle">
                  Hard-delete all dreams, interpretations, graph embeddings, and cookies. Irreversible.
                </div>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 rounded-full border border-dusk-rose/50 bg-dusk-rose/10 hover:bg-dusk-rose/20 text-dusk-rose font-sans text-xs transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Everything</span>
              </button>
            </ArchCard>
          </div>
        </section>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <ArchCard isDoubleFrame className="p-6 max-w-md w-full space-y-5 bg-surface border-dusk-rose/60">
              <div className="flex items-center gap-3 text-dusk-rose">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-serif font-medium">Delete all dream data?</h3>
              </div>
              <p className="text-xs font-serif text-text-muted leading-relaxed">
                This will permanently delete your user profile and all captured dreams, reconstructed stories, graph links, and symbol meanings. This cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <SecondaryButton onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton
                  onClick={handleDeleteAccount}
                  isLoading={isDeleting}
                  className="bg-dusk-rose hover:bg-dusk-rose/80 text-white"
                >
                  Delete Forever
                </PrimaryButton>
              </div>
            </ArchCard>
          </div>
        )}
      </div>
    </AppShell>
  );
}

