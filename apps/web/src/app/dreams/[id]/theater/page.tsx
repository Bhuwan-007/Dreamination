"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  EyeOff,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  ApiError,
  apiClient,
  FilmManifestData,
  FilmSceneData,
  RenderJobState,
} from "@/lib/api-client";
import { PageBackdrop } from "@/components/ui/page-backdrop";
import { HaloLoader } from "@/components/ui/halo-loader";
import { Chip } from "@/components/ui/chip";

const STAGE_COPY: Record<string, string> = {
  queued: "Gathering the fragments…",
  directing: "Reading each scene of your dream…",
  art: "Painting the backdrops and the people in them…",
  voices: "Giving voices to shadows…",
  package: "Binding the reel…",
};

const PLAYER_SRC = "/player/film.html";

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Phase = "loading" | "rendering" | "ready" | "error";

export default function DreamTheaterPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const dreamId = (params?.id as string) || "";
  const isExpress = searchParams?.get("express") === "true";

  const [phase, setPhase] = useState<Phase>("loading");
  const [job, setJob] = useState<RenderJobState | null>(null);
  const [manifest, setManifest] = useState<FilmManifestData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const manifestRef = useRef<FilmManifestData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportNote, setExportNote] = useState<string | null>(null);

  const send = useCallback((msg: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(msg, window.location.origin);
  }, []);

  // Sent whenever we have a film AND whenever the player (re)announces itself, so neither
  // side can miss the other however the iframe load and the API calls interleave.
  // The player ignores a manifest it is already showing.
  const pushManifestToPlayer = useCallback(() => {
    if (manifestRef.current) {
      send({ type: "LOAD_FILM", manifest: manifestRef.current });
    }
  }, [send]);

  // ---- Loading / rendering -----------------------------------------------------------

  const loadManifest = useCallback(async () => {
    const m = await apiClient.getDreamManifest(dreamId);
    manifestRef.current = m;
    setManifest(m);
    setPhase("ready");
    pushManifestToPlayer();
  }, [dreamId, pushManifestToPlayer]);

  const pollUntilDone = useCallback(async () => {
    for (;;) {
      const state = await apiClient.getRenderStatus(dreamId);
      setJob(state);
      if (state.status === "completed") return loadManifest();
      if (state.status === "failed") throw new Error(state.error || "The film could not be rendered.");
      await new Promise((r) => setTimeout(r, 1500));
    }
  }, [dreamId, loadManifest]);

  const startRender = useCallback(async () => {
    setErrorMessage(null);
    setPhase("rendering");
    try {
      let state: RenderJobState;
      try {
        state = await apiClient.renderDream(dreamId);
      } catch (err) {
        if (err instanceof ApiError && err.status === 400) {
          // No story yet (e.g. express screening): weave one, then render.
          await apiClient.reconstructDream(dreamId, "faithful");
          state = await apiClient.renderDream(dreamId);
        } else {
          throw err;
        }
      }
      setJob(state);
      await pollUntilDone();
    } catch (err: any) {
      setErrorMessage(err?.data?.detail || err?.message || "The film could not be rendered.");
      setPhase("error");
    }
  }, [dreamId, pollUntilDone]);

  useEffect(() => {
    if (!dreamId) return;
    let cancelled = false;
    (async () => {
      try {
        const status = await apiClient.getRenderStatus(dreamId);
        if (cancelled) return;
        if (status.status === "processing") {
          setPhase("rendering");
          setJob(status);
          await pollUntilDone();
          return;
        }
        if (isExpress || !status.manifest_ready) {
          await startRender();
          return;
        }
        await loadManifest();
      } catch (err: any) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          await startRender();
        } else {
          setErrorMessage(err?.message || "Could not open this dream's film.");
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dreamId, isExpress, loadManifest, pollUntilDone, startRender]);

  // ---- Player bridge -------------------------------------------------------------------

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      switch (data.type) {
        case "FILM_PLAYER_READY":
          pushManifestToPlayer();
          break;
        case "FILM_STATUS":
          setCurrentTime(data.currentTime ?? 0);
          setIsPlaying(!!data.isPlaying);
          setMuted(!!data.muted);
          if (typeof data.sceneIndex === "number") setSceneIndex(data.sceneIndex);
          break;
        case "EXPORT_PROGRESS":
          setExportProgress(data.progress ?? 0);
          break;
        case "EXPORT_COMPLETE":
          setExporting(false);
          setExportNote(`Saved as ${String(data.format || "video").toUpperCase()}.`);
          break;
        case "EXPORT_ERROR":
          setExporting(false);
          setExportNote(data.error || "Export failed.");
          break;
        case "FILM_ERROR":
          setErrorMessage("The player could not load this film's images or sounds.");
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pushManifestToPlayer]);

  const handleIframeLoad = () => pushManifestToPlayer();

  const seek = (t: number) => {
    setCurrentTime(t);
    send({ type: "SEEK", time: t });
  };

  const handleExport = () => {
    setExportNote(null);
    setExporting(true);
    setExportProgress(0);
    send({ type: "EXPORT" });
  };

  const total = manifest?.totalDuration ?? 0;
  const castById = new Map((manifest?.cast ?? []).map((c) => [c.castId, c]));
  const imageProvider = manifest?.provenance?.imageProvider;
  const director = manifest?.provenance?.director;

  return (
    <div data-theme="night" className="relative min-h-screen bg-bg text-text font-sans pb-24">
      <PageBackdrop src="/art/watch-frame.webp" alt="" opacity={0.6} priority headerBandOnly />

      <header className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/dreams/${dreamId}/reflect`}
            className="p-2 rounded-lg border border-hairline/70 text-mist hover:text-text hover:border-accent/60 transition-colors"
            aria-label="Back to reflection"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-accent/90">Watch</p>
            <h1 className="font-serif text-xl sm:text-2xl text-text truncate">
              {manifest?.title || "Your dream, as a film"}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startRender}
            disabled={phase === "rendering" || exporting}
            className="px-3 py-2 rounded-lg border border-hairline/80 text-sm text-mist hover:text-text hover:border-accent/60 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${phase === "rendering" ? "animate-spin motion-reduce:animate-none" : ""}`} />
            Re-render
          </button>
          <button
            onClick={handleExport}
            disabled={phase !== "ready" || exporting}
            className="px-3 py-2 rounded-lg bg-lantern text-void text-sm font-semibold hover:bg-lantern-soft disabled:opacity-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {exporting ? `Recording ${exportProgress}%` : "Export film"}
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 mt-6 space-y-6">
        {manifest?.stale && phase === "ready" && (
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-accent/40 bg-surface/80 text-sm">
            <AlertTriangle className="w-4 h-4 text-accent" />
            <span className="text-cloud">Your story changed after this film was made.</span>
            <button onClick={startRender} className="underline text-accent">Render the new version</button>
          </div>
        )}
        {exportNote && <p className="text-sm text-mist" role="status">{exportNote}</p>}

        {/* Stage */}
        <section className="relative aspect-video w-full rounded-2xl border border-hairline/80 bg-void overflow-hidden shadow-2xl">
          <iframe
            ref={iframeRef}
            src={PLAYER_SRC}
            onLoad={handleIframeLoad}
            allow="autoplay; fullscreen"
            className={`absolute inset-0 w-full h-full border-0 ${phase === "ready" ? "" : "invisible"}`}
            title="Dream film player"
          />
          {phase !== "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-void/90">
              {phase === "error" ? (
                <div className="text-center space-y-3 max-w-md">
                  <AlertTriangle className="w-6 h-6 text-accent mx-auto" />
                  <p className="text-cloud">{errorMessage}</p>
                  <button onClick={startRender} className="px-4 py-2 rounded-lg bg-lantern text-void text-sm font-semibold">
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  <HaloLoader
                    stageText={STAGE_COPY[job?.stage || "queued"] || "Gathering the fragments…"}
                    subText={phase === "loading" ? undefined : "Every scene is painted from your own words."}
                  />
                  {phase === "rendering" && (
                    <div className="w-64 h-1 rounded-full bg-hairline/40 overflow-hidden" aria-hidden>
                      <div className="h-full bg-accent transition-all duration-500" style={{ width: `${Math.round((job?.progress ?? 0) * 100)}%` }} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>

        {/* Controls */}
        {phase === "ready" && (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-hairline/60 bg-surface/80">
            <button
              onClick={() => send({ type: isPlaying ? "PAUSE" : "PLAY" })}
              className="p-2.5 rounded-lg bg-lantern text-void"
              aria-label={isPlaying ? "Pause" : "Play"}
              disabled={exporting}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
            <input
              type="range"
              min={0}
              max={total || 1}
              step={0.05}
              value={currentTime}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="flex-1 accent-lantern"
              aria-label="Seek"
              disabled={exporting}
            />
            <span className="text-xs font-mono text-mist w-24 text-right">
              {formatTime(currentTime)} / {formatTime(total)}
            </span>
            <button
              onClick={() => send({ type: "SET_MUTED", muted: !muted })}
              className="p-2 rounded-lg border border-hairline/70 text-mist hover:text-text"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        )}

        {manifest && (
          <>
            {/* Cast */}
            <section aria-labelledby="cast-heading" className="space-y-3">
              <h2 id="cast-heading" className="font-serif text-lg flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" /> Who appears ({manifest.cast.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {manifest.cast.map((c) => (
                  <div key={c.castId} className="rounded-xl border border-hairline/60 bg-surface/80 p-3 flex flex-col items-center text-center gap-2">
                    <div className="h-28 w-full rounded-lg bg-void flex items-end justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.figureUrl} alt={`Ink figure of ${c.name}`} className="h-24 object-contain" />
                    </div>
                    <span className="text-sm text-text truncate max-w-full">{c.name}</span>
                    <div className="flex flex-wrap justify-center gap-1">
                      {c.returning && <Chip variant="lantern">returning</Chip>}
                      {c.visibility !== "full" && (
                        <Chip variant="mist" icon={<EyeOff className="w-3 h-3" />}>face unseen</Chip>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Scenes */}
            <section aria-labelledby="scenes-heading" className="space-y-3">
              <h2 id="scenes-heading" className="font-serif text-lg">Scenes</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {manifest.scenes.map((s: FilmSceneData, idx: number) => {
                  const sky = s.layers.find((l) => l.depth === "sky");
                  const active = idx === sceneIndex;
                  return (
                    <button
                      key={s.sceneId + "-" + idx}
                      onClick={() => seek(s.startTime + 0.05)}
                      className={`text-left rounded-xl border overflow-hidden bg-surface/80 transition-colors ${
                        active ? "border-accent ring-1 ring-accent/50" : "border-hairline/60 hover:border-accent/50"
                      }`}
                    >
                      {sky && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sky.url} alt="" className="w-full aspect-video object-cover" />
                      )}
                      <div className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-serif text-text truncate">{idx + 1}. {s.heading}</span>
                          <span className="text-xs font-mono text-mist">{formatTime(s.startTime)}</span>
                        </div>
                        <p className="text-xs text-mist line-clamp-2">{s.setting}</p>
                        <div className="flex flex-wrap gap-1">
                          <Chip variant="lake">{s.mood}</Chip>
                          {s.characters.map((c) => (
                            <Chip key={c.castId} variant="mist">{castById.get(c.castId)?.name ?? c.castId}</Chip>
                          ))}
                          {s.objects.slice(0, 3).map((o) => (
                            <Chip key={o.name} variant="leaf">{o.name}</Chip>
                          ))}
                          {s.effects.map((e) => (
                            <Chip key={e.type} variant="dusk-rose">{e.type}</Chip>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* How this was made */}
            <section className="rounded-xl border border-hairline/60 bg-surface/70 p-4 text-sm text-mist space-y-1">
              <p className="flex items-center gap-2 text-cloud">
                <Sparkles className="w-4 h-4 text-accent" /> How this film was made
              </p>
              <p>
                Direction:{" "}
                {director === "llm"
                  ? "every scene art-directed by the AI from your words."
                  : director === "mixed"
                  ? "some scenes art-directed by the AI; the rest built directly from your words."
                  : "built directly from your words (the AI director was unavailable)."}
              </p>
              <p>
                Backdrops:{" "}
                {imageProvider === "procedural"
                  ? "hand-drawn ink generated on this server. Add an image provider for painted backdrops."
                  : `painted with ${imageProvider}.`}{" "}
                Characters are always drawn as ink figures from how you described them, so they look the same in every dream.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
