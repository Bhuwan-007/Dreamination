"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Clapperboard,
  Code,
  Copy,
  Eye,
  Layers,
  MapPin,
  Play,
  RefreshCw,
  Volume2,
} from "lucide-react";
import {
  apiClient,
  DirectorSceneData,
  DirectorScriptData,
} from "@/lib/api-client";

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  let token = apiClient.getToken();
  if (!token) {
    token = await apiClient.ensureAuthenticated();
  }
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}

export default function DreamTheaterPage() {
  const params = useParams();
  const dreamId = (params?.id as string) || "";

  const [script, setScript] = useState<DirectorScriptData | null>(null);
  const [activeTab, setActiveTab] = useState<"stage" | "inspector" | "json">("stage");
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function loadScript() {
      if (!dreamId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setErrorMessage(null);
      try {
        let data: DirectorScriptData;
        if (apiClient && typeof apiClient.getDirectorScript === "function") {
          data = await apiClient.getDirectorScript(dreamId);
        } else {
          const res = await fetchWithAuth(`http://localhost:8000/dreams/${dreamId}/director`);
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.detail || `Failed to load director script: ${res.statusText}`);
          }
          data = await res.json();
        }
        if (!cancelled) {
          setScript(data);
        }
      } catch (err: any) {
        console.error("Failed to load director script:", err);
        if (!cancelled) {
          setErrorMessage(err.message || "Failed to load director script.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadScript();

    return () => {
      cancelled = true;
    };
  }, [dreamId]);

  const handleReDirect = async () => {
    if (!dreamId) return;
    setIsRedirecting(true);
    setErrorMessage(null);
    try {
      let data: DirectorScriptData;
      if (apiClient && typeof apiClient.generateDirectorScript === "function") {
        data = await apiClient.generateDirectorScript(dreamId, "nocturne_toon");
      } else {
        const res = await fetchWithAuth(
          `http://localhost:8000/dreams/${dreamId}/director?style_id=nocturne_toon`,
          {
            method: "POST",
          }
        );
        if (!res.ok) {
          throw new Error(`Failed to direct dream: ${res.statusText}`);
        }
        data = await res.json();
      }
      setScript(data);
      setSelectedSceneIndex(0);
    } catch (err: any) {
      console.error("Re-direct failed:", err);
      setErrorMessage(err.message || "Failed to direct dream.");
    } finally {
      setIsRedirecting(false);
    }
  };

  const handleCopyJson = () => {
    if (!script) return;
    navigator.clipboard.writeText(JSON.stringify(script, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentScene: DirectorSceneData | undefined = script?.scenes?.[selectedSceneIndex];

  return (
    <div className="relative min-h-screen bg-void text-cloud font-sans selection:bg-lantern/20 selection:text-lantern pb-24">
      {/* Background artwork ambience (strict -z-10 layer) */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden" style={{ zIndex: -1 }}>
        <div className="absolute inset-0 bg-void/80 z-10" />
        <Image
          src="/art/night-void.webp"
          alt="Atmospheric Void"
          fill
          className="object-cover object-center"
          style={{ opacity: 0.28 }}
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/60 to-void/90 z-20" />
      </div>

      {/* Header Bar */}
      <header className="relative z-20 w-full border-b border-hairline/60 bg-void/85 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dreams/${dreamId}/reflect`}
            className="p-2 rounded-lg border border-hairline hover:border-lantern/60 text-mist hover:text-cloud transition-colors"
            title="Back to Reflection"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-lantern" />
              <h1 className="text-base font-serif font-medium text-cloud">
                {script?.title || "3D Dream Theater"}
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-lantern/10 border border-lantern/30 text-lantern">
                {script?.style_id || "nocturne_toon"}
              </span>
            </div>
            <p className="text-xs text-mist font-serif">
              Directed 3D performance from validated action vocabulary
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReDirect}
            disabled={isRedirecting || isLoading}
            className="px-3 py-1.5 rounded-lg border border-hairline bg-surface hover:border-lantern/60 text-xs font-serif text-mist hover:text-cloud transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRedirecting ? "animate-spin text-lantern" : ""}`} />
            <span>{isRedirecting ? "Directing..." : "Re-Direct Dream"}</span>
          </button>

          <Link
            href="/lexicon"
            className="px-3.5 py-1.5 rounded-lg bg-surface border border-hairline text-xs font-serif text-mist hover:text-cloud hover:border-hairline/80 transition-colors"
          >
            Lexicon & Weather
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="py-24 text-center space-y-4">
            <div className="inline-block p-4 rounded-full border border-lantern/30 bg-forest-night/60 animate-pulse">
              <Clapperboard className="w-8 h-8 text-lantern animate-spin" />
            </div>
            <p className="text-sm font-serif text-mist">
              Directing camera shots, world kits, and character locomotion...
            </p>
          </div>
        ) : errorMessage ? (
          <div className="max-w-md mx-auto p-6 rounded-2xl border border-dusk-rose/40 bg-surface text-center space-y-4">
            <p className="text-sm text-dusk-rose font-serif">{errorMessage}</p>
            <button
              onClick={handleReDirect}
              className="px-4 py-2 rounded-xl bg-lantern text-void font-semibold text-xs shadow-lantern"
            >
              Try Directing Again
            </button>
          </div>
        ) : script ? (
          <div className="space-y-6">
            {/* View Mode Tabs */}
            <div className="flex items-center justify-between border-b border-hairline/60 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("stage")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-serif transition-colors flex items-center gap-1.5 ${
                    activeTab === "stage"
                      ? "bg-lantern text-void font-semibold shadow-lantern"
                      : "text-mist hover:text-cloud bg-surface border border-hairline"
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>3D Live Stage</span>
                </button>

                <button
                  onClick={() => setActiveTab("inspector")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-serif transition-colors flex items-center gap-1.5 ${
                    activeTab === "inspector"
                      ? "bg-lantern text-void font-semibold shadow-lantern"
                      : "text-mist hover:text-cloud bg-surface border border-hairline"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Screenplay Inspector ({script.scenes?.length || 0} Scenes)</span>
                </button>

                <button
                  onClick={() => setActiveTab("json")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-serif transition-colors flex items-center gap-1.5 ${
                    activeTab === "json"
                      ? "bg-lantern text-void font-semibold shadow-lantern"
                      : "text-mist hover:text-cloud bg-surface border border-hairline"
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>Director JSON</span>
                </button>
              </div>

              {activeTab === "json" && (
                <button
                  onClick={handleCopyJson}
                  className="px-3 py-1 rounded-lg border border-hairline text-xs font-mono text-mist hover:text-cloud hover:border-lantern flex items-center gap-1.5"
                >
                  <Copy className="w-3 h-3 text-lantern" />
                  <span>{copied ? "Copied!" : "Copy JSON"}</span>
                </button>
              )}
            </div>

            {/* TAB 1: 3D LIVE STAGE */}
            {activeTab === "stage" && (
              <div className="space-y-6">
                <div className="relative aspect-video w-full rounded-2xl border border-hairline/80 bg-forest-night/80 overflow-hidden shadow-2xl flex flex-col items-center justify-center">
                  {/* Embedded Three.js player frame */}
                  <iframe
                    src="http://localhost:5173"
                    className="w-full h-full border-none"
                    title="Three.js Dream Player"
                  />

                  {/* Top Overlay HUD */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-2 bg-void/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-hairline pointer-events-auto">
                      <Camera className="w-3.5 h-3.5 text-lantern" />
                      <span className="text-[11px] font-mono text-cloud">
                        Shot: {currentScene?.beats?.[0]?.args?.preset || "wide"}
                      </span>
                      <span className="text-hairline">|</span>
                      <span className="text-[11px] font-mono text-mist">
                        Kit: {currentScene?.world?.kit || "void"}
                      </span>
                    </div>

                    <div className="bg-void/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-hairline pointer-events-auto flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-mono text-mist">60 FPS</span>
                    </div>
                  </div>
                </div>

                {/* Scene Timeline Selector */}
                <div className="p-4 rounded-2xl border border-hairline/60 bg-surface/60 backdrop-blur-md space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-serif uppercase tracking-wider text-mist flex items-center gap-2">
                      <Clapperboard className="w-3.5 h-3.5 text-lantern" />
                      <span>Scene Sequence ({script.scenes?.length || 0} Scenes)</span>
                    </div>
                    <span className="text-xs font-mono text-mist">
                      Scene {selectedSceneIndex + 1} of {script.scenes?.length || 0}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    {script.scenes?.map((scene, idx) => (
                      <button
                        key={scene.scene_id}
                        onClick={() => setSelectedSceneIndex(idx)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          selectedSceneIndex === idx
                            ? "bg-forest-night border-lantern/80 shadow-lantern ring-1 ring-lantern/50"
                            : "bg-void/60 border-hairline hover:border-lantern/40 text-mist"
                        }`}
                      >
                        <div className="text-[10px] font-mono uppercase text-mist">Scene {scene.scene_id}</div>
                        <div className="text-xs font-serif font-medium text-cloud truncate capitalize">
                          {scene.world?.kit || "void"}
                        </div>
                        <div className="text-[10px] font-mono text-lantern truncate">
                          {scene.beats?.[0]?.args?.preset || "shot"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SCREENPLAY INSPECTOR */}
            {activeTab === "inspector" && (
              <div className="space-y-6">
                {/* Scene Selector Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-hairline/40">
                  {script.scenes?.map((s, idx) => (
                    <button
                      key={s.scene_id}
                      onClick={() => setSelectedSceneIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-serif whitespace-nowrap transition-colors ${
                        selectedSceneIndex === idx
                          ? "bg-lantern text-void font-semibold"
                          : "bg-surface border border-hairline text-mist hover:text-cloud"
                      }`}
                    >
                      Scene {s.scene_id}: {s.world?.kit || "void"}
                    </button>
                  ))}
                </div>

                {currentScene && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Column: World & Atmosphere */}
                    <div className="space-y-4">
                      <div className="p-5 rounded-2xl border border-hairline bg-surface/80 space-y-4">
                        <div className="text-xs font-serif uppercase tracking-wider text-mist flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-lantern" />
                          <span>World Environment</span>
                        </div>

                        <div className="space-y-2.5 text-xs">
                          <div className="flex justify-between py-1 border-b border-hairline/40">
                            <span className="text-mist">World Kit:</span>
                            <span className="font-mono text-cloud font-medium capitalize">{currentScene.world?.kit || "void"}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-hairline/40">
                            <span className="text-mist">Sky Preset:</span>
                            <span className="font-mono text-cloud">{currentScene.world?.sky || "night"}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-hairline/40">
                            <span className="text-mist">Light Preset:</span>
                            <span className="font-mono text-cloud">{currentScene.world?.light || "soft"}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-hairline/40">
                            <span className="text-mist">Transition In:</span>
                            <span className="font-mono text-cloud">{currentScene.transition_in || "dissolve"}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-hairline/40">
                            <span className="text-mist">Fog Density:</span>
                            <span className="font-mono text-cloud">{currentScene.world?.fog?.density ?? 0.03}</span>
                          </div>
                        </div>

                        {/* Props Placed */}
                        <div className="pt-2 space-y-2">
                          <span className="text-[11px] font-serif uppercase text-mist block">Props Placed</span>
                          {currentScene.world?.props && currentScene.world.props.length > 0 ? (
                            <div className="space-y-1.5">
                              {currentScene.world.props.map((p, pIdx) => (
                                <div key={pIdx} className="p-2 rounded-lg bg-void/60 border border-hairline text-[11px] flex justify-between">
                                  <span className="font-mono text-lantern">{p.id}</span>
                                  <span className="text-mist">at {p.anchor}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-sage italic">No props in this scene</span>
                          )}
                        </div>

                        {/* Effects */}
                        {currentScene.world?.effects && currentScene.world.effects.length > 0 && (
                          <div className="pt-2 space-y-2">
                            <span className="text-[11px] font-serif uppercase text-mist block">Dream Logic Effects</span>
                            <div className="space-y-1.5">
                              {currentScene.world.effects.map((ef, eIdx) => (
                                <div key={eIdx} className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-[11px] flex justify-between">
                                  <span className="font-mono text-emerald-400 capitalize">{ef.type}</span>
                                  <span className="text-mist">at {ef.at}s ({ef.duration}s)</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Ambient Audio */}
                      <div className="p-5 rounded-2xl border border-hairline bg-surface/80 space-y-3">
                        <div className="text-xs font-serif uppercase tracking-wider text-mist flex items-center gap-1.5">
                          <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Soundscape</span>
                        </div>
                        <div className="text-xs space-y-1">
                          <div className="text-mist">Ambient Bed: <span className="font-mono text-cloud">{currentScene.ambient || "quiet_wind"}</span></div>
                          {currentScene.sound_motif && (
                            <div className="text-mist">Sound Motif: <span className="font-mono text-lantern">{currentScene.sound_motif}</span></div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle Column: Cast Members */}
                    <div className="space-y-4">
                      <div className="p-5 rounded-2xl border border-hairline bg-surface/80 space-y-4">
                        <div className="text-xs font-serif uppercase tracking-wider text-mist flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-lantern" />
                          <span>Scene Cast ({currentScene.cast?.length || 0})</span>
                        </div>

                        {currentScene.cast && currentScene.cast.length > 0 ? (
                          <div className="space-y-3">
                            {currentScene.cast.map((member, mIdx) => (
                              <div key={mIdx} className="p-3 rounded-xl bg-void/60 border border-hairline space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-serif font-medium text-cloud text-sm">{member.name}</span>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-hairline text-mist uppercase">
                                    {member.face_visibility || "full"}
                                  </span>
                                </div>
                                <div className="text-xs text-mist flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-sage" />
                                  <span>Spawn anchor: <code className="text-cloud">{member.spawn}</code></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-sage italic">No character cast present in this scene.</p>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Action Beats Timeline */}
                    <div className="space-y-4">
                      <div className="p-5 rounded-2xl border border-hairline bg-surface/80 space-y-4">
                        <div className="text-xs font-serif uppercase tracking-wider text-mist flex items-center gap-1.5">
                          <Clapperboard className="w-3.5 h-3.5 text-lantern" />
                          <span>Action Beats Timeline</span>
                        </div>

                        <div className="space-y-2.5">
                          {currentScene.beats?.map((beat, bIdx) => (
                            <div key={bIdx} className="p-3 rounded-xl bg-void/60 border border-hairline space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-mono text-lantern">t = {beat.t.toFixed(1)}s</span>
                                <span className="font-mono text-mist uppercase text-[10px] px-1.5 py-0.5 rounded bg-surface">
                                  {beat.actor}
                                </span>
                              </div>

                              <div className="flex items-baseline gap-2">
                                <span className="text-xs font-serif font-semibold text-cloud capitalize">
                                  {beat.action}
                                </span>
                                {beat.action === "shot" && (
                                  <span className="text-xs font-mono text-cyan-400">
                                    preset: {beat.args?.preset}
                                  </span>
                                )}
                                {beat.action === "walk_to" && (
                                  <span className="text-xs font-mono text-emerald-400">
                                    to: {beat.args?.anchor}
                                  </span>
                                )}
                                {beat.action === "animate" && (
                                  <span className="text-xs font-mono text-purple-400">
                                    clip: {beat.args?.clip}
                                  </span>
                                )}
                              </div>

                              {beat.action === "speak" && beat.args?.line && (
                                <div className="mt-2 p-2 rounded bg-surface border border-hairline/60 text-xs font-serif italic text-cloud">
                                  &ldquo;{beat.args.line}&rdquo;
                                  {beat.args.emotion && (
                                    <span className="ml-2 not-italic text-[10px] font-mono text-lantern">
                                      ({beat.args.emotion})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: RAW DIRECTOR JSON */}
            {activeTab === "json" && (
              <div className="p-6 rounded-2xl border border-hairline/80 bg-forest-night/90 overflow-x-auto">
                <pre className="text-xs font-mono text-cloud/90 leading-relaxed">
                  {JSON.stringify(script, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-md mx-auto p-6 rounded-2xl border border-hairline/60 bg-surface/60 text-center space-y-4">
            <p className="text-sm text-mist font-serif">No director script found for this dream yet.</p>
            <button
              onClick={handleReDirect}
              className="px-4 py-2 rounded-xl bg-lantern text-void font-semibold text-xs shadow-lantern"
            >
              Direct Dream Now
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
