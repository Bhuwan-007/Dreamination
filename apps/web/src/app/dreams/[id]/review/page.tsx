"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Edit3,
  Undo2,
  Film,
  Compass,
  Layers,
  ChevronRight,
  MessageSquare,
  Moon,
} from "lucide-react";
import {
  apiClient,
  BeatItem,
  DialogueItem,
  DreamVersionResponse,
  ReconstructedScene,
  ReconstructionOutput,
} from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { PageBackdrop } from "@/components/ui/page-backdrop";

interface PageProps {
  params: { id: string };
}

export default function ReconstructionReviewPage({ params }: PageProps) {
  const dreamId = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExpressMode = searchParams.get("express") === "true";
  const { toast, errorToast } = useToast();

  // Core reconstruction state
  const [activeMode, setActiveMode] = useState<"faithful" | "authored">("faithful");
  const [currentVersion, setCurrentVersion] = useState<DreamVersionResponse | null>(null);
  const [story, setStory] = useState<ReconstructionOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWeavingMode, setIsWeavingMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inferred tooltip state
  const [activeTooltip, setActiveTooltip] = useState<{
    sceneId: number;
    beatIndex: number;
    beat: BeatItem;
  } | null>(null);

  // Single-scene repair drawer state
  const [repairingSceneId, setRepairingSceneId] = useState<number | null>(null);
  const [repairCorrection, setRepairCorrection] = useState("");
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairedSceneIds, setRepairedSceneIds] = useState<number[]>([]);

  // Approval state
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  // Load or reconstruct dream on mount
  useEffect(() => {
    async function loadReconstruction() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        // Try fetching existing versions first
        const versions = await apiClient.listDreamVersions(dreamId);
        const match = versions.find((v) => v.mode === activeMode);

        if (match) {
          setCurrentVersion(match);
          setStory(match.story);
          if (match.is_approved) setIsApproved(true);
        } else {
          // Trigger initial reconstruction
          const newVersion = await apiClient.reconstructDream(dreamId, activeMode);
          setCurrentVersion(newVersion);
          setStory(newVersion.story);
        }
      } catch (err: any) {
        console.error("Failed to load reconstructed story:", err);
        setErrorMessage(err.message || "Failed to reconstruct dream story.");
      } finally {
        setIsLoading(false);
      }
    }

    if (dreamId) {
      loadReconstruction();
    }
  }, [dreamId, activeMode]);

  // Handle switching between Faithful and Authored
  const handleModeSwitch = async (newMode: "faithful" | "authored", forceRebuild = false) => {
    if (newMode === activeMode && !forceRebuild) return;
    if (isWeavingMode) return;
    setActiveMode(newMode);
    setIsWeavingMode(true);
    setErrorMessage(null);

    try {
      if (forceRebuild) {
        const newVersion = await apiClient.reconstructDream(dreamId, newMode, true);
        setCurrentVersion(newVersion);
        setStory(newVersion.story);
      } else {
        const versions = await apiClient.listDreamVersions(dreamId);
        const match = versions.find((v) => v.mode === newMode);

        if (match) {
          setCurrentVersion(match);
          setStory(match.story);
        } else {
          const newVersion = await apiClient.reconstructDream(dreamId, newMode);
          setCurrentVersion(newVersion);
          setStory(newVersion.story);
        }
      }
    } catch (err: any) {
      console.error("Failed to switch reconstruction mode:", err);
      setErrorMessage(err.message || "Failed to switch mode.");
    } finally {
      setIsWeavingMode(false);
    }
  };

  const handleReweave = async () => {
    await handleModeSwitch(activeMode, true);
  };

  // Single Scene Repair
  const handleRepairScene = async (sceneId: number) => {
    if (!repairCorrection.trim() || isRepairing) return;
    setIsRepairing(true);

    try {
      const res = await apiClient.repairScene(dreamId, sceneId, repairCorrection);
      if (story) {
        const updatedScenes = story.scenes.map((s) =>
          s.scene_id === sceneId ? res.scene : s
        );
        setStory({ ...story, scenes: updatedScenes });
        setRepairedSceneIds((prev) => [...prev, sceneId]);
      }
      setRepairingSceneId(null);
      setRepairCorrection("");
    } catch (err: any) {
      console.error("Single scene repair failed:", err);
      errorToast(err.message || "Failed to repair scene.");
    } finally {
      setIsRepairing(false);
    }
  };

  // Approve Dream and Step Through to Reflection
  const handleApprove = async () => {
    if (isApproving || !currentVersion) return;
    if (isApproved) {
      router.push(`/dreams/${dreamId}/reflect`);
      return;
    }
    setIsApproving(true);

    try {
      await apiClient.approveDream(dreamId, currentVersion.id);
      setIsApproved(true);
      router.push(`/dreams/${dreamId}/reflect`);
    } catch (err: any) {
      console.error("Failed to approve dream:", err);
      errorToast(err.message || "Failed to approve dream.");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-bg text-text font-sans selection:bg-accent/20 selection:text-accent pb-32">
      {/* 1. Luminous Weave Background Art */}
      <PageBackdrop src="/art/weave.webp" opacity={0.42} priority />

      {/* 2. Top Navigation Bar */}
      <header className="relative z-10 w-full border-b border-hairline/60 bg-void/75 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/capture"
            className="flex items-center gap-2 text-xs uppercase tracking-widest text-mist hover:text-cloud transition-colors"
          >
            <Compass className="w-4 h-4 text-lantern" />
            <span className="font-medium">The Dream Machine</span>
          </Link>
          <span className="text-graphite text-xs">/</span>
          <span className="text-xs text-accent font-serif">
            Step 2 · Weave
          </span>
        </div>

        {/* Mode Switcher Pill & Re-weave Action */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate/80 border border-hairline rounded-full p-1 shadow-inner">
            <button
              onClick={() => handleModeSwitch("faithful")}
              className={`px-4 py-1.5 rounded-full text-xs font-serif transition-all duration-300 flex items-center gap-1.5 ${
                activeMode === "faithful"
                  ? "bg-lantern text-void font-semibold shadow-lantern"
                  : "text-mist hover:text-cloud"
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Faithful</span>
              <span className="text-[10px] opacity-75 hidden sm:inline">(Raw Memory)</span>
            </button>
            <button
              onClick={() => handleModeSwitch("authored")}
              className={`px-4 py-1.5 rounded-full text-xs font-serif transition-all duration-300 flex items-center gap-1.5 ${
                activeMode === "authored"
                  ? "bg-lantern text-void font-semibold shadow-lantern"
                  : "text-mist hover:text-cloud"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Authored Arc</span>
              <span className="text-[10px] opacity-75 hidden sm:inline">(Cinematic Arc)</span>
            </button>
          </div>

          <button
            onClick={handleReweave}
            disabled={isWeavingMode || isLoading}
            className="p-2 rounded-full border border-hairline bg-slate/80 text-mist hover:text-lantern hover:border-lantern transition-colors"
            title="Re-weave this story from raw fragments"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isWeavingMode ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* 3. Main Content Editorial Reading Column */}
      <main className="relative z-10 max-w-[62ch] mx-auto px-6 pt-12">
        {/* Loading / Weaving States */}
        {(isLoading || isWeavingMode) && (
          <div className="py-24 text-center space-y-6">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-lantern/30 animate-ping" />
              <div className="w-12 h-12 rounded-full border border-lantern/80 flex items-center justify-center bg-void/80 text-lantern animate-spin">
                <Sparkles className="w-6 h-6" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="font-serif text-2xl text-cloud">
                {isWeavingMode ? "Weaving alternate arc..." : "Gathering dream fragments..."}
              </h2>
              <p className="text-sm text-mist font-serif italic">
                Bridging emotional continuity and respecting surreal dream logic.
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {errorMessage && !isLoading && (
          <div className="p-6 rounded-2xl bg-dusk-rose/10 border border-dusk-rose/30 text-center space-y-4 my-8">
            <AlertCircle className="w-8 h-8 text-dusk-rose mx-auto" />
            <p className="text-sm text-cloud font-serif">{errorMessage}</p>
            <button
              onClick={() => handleModeSwitch(activeMode)}
              className="px-4 py-2 rounded-xl bg-slate border border-hairline text-xs text-cloud hover:bg-surface-raised"
            >
              Retry Reconstruction
            </button>
          </div>
        )}

        {/* Reconstructed Story View (The Recognition Moment) */}
        {!isLoading && !isWeavingMode && story && (
          <div className="space-y-12 animate-fade-in">
            {/* Story Header */}
            <div className="text-center space-y-3 pb-6 border-b border-hairline/40">
              <span className="text-[11px] uppercase tracking-widest text-lantern/90 font-medium">
                {story.mode === "faithful" ? "Faithful Reconstruction" : "Authored Cinematic Arc"}
              </span>
              <h1 className="font-serif text-3xl md:text-4xl text-cloud tracking-tight leading-tight">
                {story.title}
              </h1>
              <p className="text-xs text-mist font-serif italic max-w-md mx-auto">
                Hover or tap any{" "}
                <span className="text-lantern underline decoration-lantern/60 underline-offset-4 font-normal">
                  golden shimmering sentence
                </span>{" "}
                to inspect how the Dream Weaver bridged the non-linear gap.
              </p>
            </div>

            {/* Scenes List with Vertical Lantern Path Line */}
            <div className="relative pl-8 space-y-12 before:absolute before:left-3 before:top-4 before:bottom-4 before:w-[1px] before:bg-gradient-to-b before:from-lantern/60 before:via-hairline before:to-transparent">
              {story.scenes.map((scene, sIdx) => {
                const isRepaired = repairedSceneIds.includes(scene.scene_id);

                return (
                  <article
                    key={scene.scene_id}
                    className={`relative space-y-4 rounded-2xl p-6 transition-all duration-500 ${
                      isRepaired
                        ? "bg-lantern/5 border border-lantern/40 shadow-lantern"
                        : "bg-slate/50 border border-hairline/60 hover:border-hairline hover:bg-slate/70"
                    }`}
                  >
                    {/* Lantern Marker on Path Line */}
                    <div className="absolute -left-[27px] top-7 w-5 h-5 rounded-full bg-void border border-lantern text-lantern flex items-center justify-center text-[10px] font-mono shadow-sm">
                      {scene.scene_id}
                    </div>

                    {/* Scene Heading */}
                    <div className="flex items-center justify-between pb-2 border-b border-hairline/30">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-lantern uppercase tracking-wider">
                          Scene {scene.scene_id}
                        </span>
                        <span className="text-mist text-xs">·</span>
                        <h2 className="font-serif text-base text-cloud tracking-wide">
                          {scene.heading}
                        </h2>
                      </div>

                      {/* Scene Action Button */}
                      <button
                        onClick={() => {
                          setRepairingSceneId(
                            repairingSceneId === scene.scene_id ? null : scene.scene_id
                          );
                          setRepairCorrection("");
                        }}
                        className="text-xs text-mist hover:text-lantern flex items-center gap-1.5 transition-colors px-2.5 py-1 rounded-lg border border-transparent hover:border-hairline"
                        title="Correct this scene if it differs from your memory"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">This isn&apos;t how it was</span>
                        <span className="sm:hidden">Repair</span>
                      </button>
                    </div>

                    {/* Narrative Beats */}
                    <div className="font-serif text-lg leading-[1.8] text-cloud/95 space-y-2">
                      {scene.beats.map((beat, bIdx) => {
                        const isInferred = beat.source === "inferred";
                        const isTooltipActive =
                          activeTooltip?.sceneId === scene.scene_id &&
                          activeTooltip?.beatIndex === bIdx;

                        if (!isInferred) {
                          return (
                            <span key={bIdx} className="text-cloud/95">
                              {beat.text}{" "}
                            </span>
                          );
                        }

                        return (
                          <span key={bIdx} className="relative inline">
                            <button
                              type="button"
                              aria-expanded={isTooltipActive}
                              onClick={() => {
                                setActiveTooltip(
                                  isTooltipActive
                                    ? null
                                    : { sceneId: scene.scene_id, beatIndex: bIdx, beat }
                                );
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setActiveTooltip(
                                    isTooltipActive
                                      ? null
                                      : { sceneId: scene.scene_id, beatIndex: bIdx, beat }
                                  );
                                }
                              }}
                              className="text-left font-serif text-lg leading-[1.8] text-cloud/90 underline decoration-accent/60 decoration-wavy underline-offset-4 hover:decoration-accent hover:text-cloud hover:bg-accent/10 rounded px-1 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
                              title="Inferred narrative bridge. Tap or press Enter to inspect evidence."
                            >
                              {beat.text}
                            </button>{" "}
                            {/* Inferred Lantern Tooltip / Popover */}
                            {isTooltipActive && beat.inference_reason && (
                              <div
                                role="region"
                                aria-label="Inferred Bridge Details"
                                className="absolute left-0 bottom-full mb-2 w-72 p-4 rounded-xl bg-surface-raised border border-accent text-xs shadow-2xl z-50 text-left animate-fade-in font-sans"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center gap-1.5 text-accent font-medium pb-1.5 border-b border-hairline/40">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Inferred Bridge</span>
                                  <span className="ml-auto text-[11px] text-text-muted font-mono">
                                    {Math.round(beat.confidence * 100)}% match
                                  </span>
                                </div>
                                <p className="text-text-muted pt-2 text-xs leading-relaxed italic font-serif">
                                  &ldquo;{beat.inference_reason}&rdquo;
                                </p>
                                <div className="pt-2 text-xs text-text-subtle flex justify-between items-center">
                                  <span>Tap or press Enter to dismiss</span>
                                </div>
                              </div>
                            )}
                          </span>
                        );
                      })}
                    </div>

                    {/* Spoken Dialogue Lines */}
                    {scene.dialogue && scene.dialogue.length > 0 && (
                      <div className="pt-3 space-y-2 border-t border-hairline/20">
                        {scene.dialogue.map((dlg, dIdx) => (
                          <div
                            key={dIdx}
                            className="flex items-baseline gap-3 text-sm font-serif italic text-mist/95 bg-void/30 p-2.5 rounded-xl border border-hairline/30"
                          >
                            <span className="not-italic text-xs font-mono uppercase tracking-wider text-lantern font-semibold">
                              {dlg.speaker}:
                            </span>
                            <span className="text-cloud">&ldquo;{dlg.line}&rdquo;</span>
                            {dlg.emotion && (
                              <span className="text-[10px] text-mist/70 not-italic uppercase tracking-widest ml-auto">
                                [{dlg.emotion}]
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline Scene Repair Drawer */}
                    {repairingSceneId === scene.scene_id && (
                      <div className="pt-4 mt-4 border-t border-lantern/30 space-y-3 bg-void/60 p-4 rounded-xl animate-fade-in">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-serif text-lantern flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Tell the Weaver what actually happened here:</span>
                          </label>
                          <span className="text-[10px] text-mist font-mono">
                            Only this scene will regenerate
                          </span>
                        </div>

                        <textarea
                          value={repairCorrection}
                          onChange={(e) => setRepairCorrection(e.target.value)}
                          placeholder="e.g., The door was not in the water at all; it was suspended in mid-air over dry lavender..."
                          rows={3}
                          className="w-full rounded-xl bg-slate/90 border border-hairline p-3 text-sm text-cloud placeholder-graphite focus:outline-none focus:border-lantern font-serif resize-none"
                        />

                        <div className="flex items-center justify-end gap-3 pt-1">
                          <button
                            onClick={() => {
                              setRepairingSceneId(null);
                              setRepairCorrection("");
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs text-mist hover:text-cloud"
                          >
                            Cancel
                          </button>
                          <button
                            disabled={!repairCorrection.trim() || isRepairing}
                            onClick={() => handleRepairScene(scene.scene_id)}
                            className="px-4 py-1.5 rounded-lg bg-lantern text-void font-medium text-xs hover:bg-lantern-soft disabled:opacity-50 flex items-center gap-1.5 shadow-lantern"
                          >
                            {isRepairing ? (
                              <>
                                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                                <span>Reweaving Scene {scene.scene_id}...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Repair This Scene</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {/* Bottom Approval & Step Through Actions */}
            <div className="sticky bottom-6 z-30 pt-6">
              <div className="p-4 rounded-2xl bg-void/90 border border-lantern/60 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left space-y-0.5">
                  <div className="text-xs text-lantern font-medium flex items-center justify-center sm:justify-start gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-leaf" />
                    <span>The Recognition Moment</span>
                  </div>
                  <p className="text-xs text-mist font-serif">
                    {isApproved
                      ? "This story is approved and sealed."
                      : "Ready to step into the 3D world performance?"}
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  {/* Express Direct-to-Video Bypass */}
                  <Link
                    href={`/dreams/${dreamId}/theater?express=true`}
                    className="px-4 py-2.5 rounded-xl border border-hairline bg-slate/80 text-mist hover:text-cloud font-serif text-xs flex items-center gap-1.5 transition-colors"
                    title="Bypass story approval and launch directly into 3D theater"
                  >
                    <Film className="w-4 h-4 text-lantern" />
                    <span>Watch in 3D (Express)</span>
                  </Link>

                  {/* Primary Approval Button */}
                  <button
                    disabled={isApproving}
                    onClick={handleApprove}
                    className="px-6 py-2.5 rounded-xl bg-lantern text-void font-semibold text-xs hover:bg-lantern-soft transition-all duration-300 flex items-center gap-2 shadow-lantern flex-1 sm:flex-initial justify-center"
                  >
                    {isApproved ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-void" />
                        <span>Story Approved · Reflect</span>
                      </>
                    ) : (
                      <>
                        <span>That&apos;s my dream · Reflect</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
