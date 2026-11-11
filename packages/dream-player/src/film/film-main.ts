/**
 * Film player entry (film.html). Embedded by the web app's theater page in a same-origin
 * iframe and driven by postMessage. It never plays anything until it is given a dream's
 * own manifest — there is no built-in sample film.
 *
 * Parent -> player: LOAD_FILM {manifest} | PLAY | PAUSE | SEEK {time} | SET_MUTED {muted} | EXPORT
 * Player -> parent: FILM_READY | FILM_STATUS {...} | FILM_ERROR | EXPORT_PROGRESS | EXPORT_COMPLETE | EXPORT_ERROR
 * Standalone debugging: film.html?manifest=<url of a manifest json>
 */
import "./film.css";
import { FilmRenderer } from "./film-renderer";
import { FilmAudio } from "./film-audio";
import { captionAt, formatTime, sceneIndexAt } from "./film-timeline";
import type { FilmManifest } from "./types";

const canvas = document.getElementById("film-canvas") as HTMLCanvasElement;
const statusEl = document.getElementById("film-status")!;
const statusText = document.getElementById("film-status-text")!;
const statusBar = document.getElementById("film-status-bar") as HTMLDivElement;
const playOverlay = document.getElementById("film-play") as HTMLButtonElement;
const controls = document.getElementById("film-controls")!;
const playBtn = document.getElementById("film-toggle") as HTMLButtonElement;
const scrub = document.getElementById("film-scrub") as HTMLInputElement;
const timeEl = document.getElementById("film-time")!;

const embedded = window.parent !== window;
if (!embedded) controls.hidden = false;

const renderer = new FilmRenderer(canvas);
const audio = new FilmAudio();
let manifest: FilmManifest | null = null;
let playing = false;
let time = 0;
let perfStart = 0;
let perfFrom = 0;
let exporting = false;
let lastStatus = 0;

function post(msg: Record<string, unknown>) {
  if (embedded) window.parent.postMessage(msg, window.location.origin);
}

function setStatus(text: string | null, progress?: number) {
  statusEl.hidden = text === null;
  if (text !== null) statusText.textContent = text;
  if (typeof progress === "number") statusBar.style.width = `${Math.round(progress * 100)}%`;
}

function resize() {
  if (exporting) return;
  const w = window.innerWidth;
  const h = Math.round(w * 9 / 16) > window.innerHeight ? window.innerHeight : Math.round(w * 9 / 16);
  const ww = Math.round(h * 16 / 9);
  canvas.style.width = `${ww}px`;
  canvas.style.height = `${h}px`;
  renderer.setSize(ww, h);
}
window.addEventListener("resize", resize);
resize();

let loadedKey = "";

async function loadFilm(m: FilmManifest) {
  const key = `${m.dreamId}|${m.renderId ?? ""}|${m.versionId ?? ""}|${m.totalDuration}`;
  if (key === loadedKey) return; // the host may send the same film more than once
  loadedKey = key;
  pause();
  manifest = null;
  time = 0;
  setStatus("Painting the scenes…", 0);
  try {
    await Promise.all([
      renderer.load(m, (k) => setStatus("Painting the scenes…", k * 0.8)),
      audio.load(m, () => undefined),
    ]);
  } catch (err) {
    loadedKey = "";
    setStatus("This film could not be loaded.");
    post({ type: "FILM_ERROR", error: String(err) });
    return;
  }
  manifest = m;
  scrub.max = String(m.totalDuration);
  setStatus(null);
  playOverlay.hidden = false;
  renderer.render(0);
  post({ type: "FILM_READY", totalDuration: m.totalDuration });
  sendStatus(true);
}

function clockNow(): number {
  if (audio.isRunning && audio.ctx.state === "running") return audio.now();
  return perfFrom + (performance.now() - perfStart) / 1000;
}

async function play() {
  if (!manifest) return;
  if (time >= manifest.totalDuration - 0.05) time = 0;
  const audible = await audio.resume();
  perfStart = performance.now();
  perfFrom = time;
  if (audible) audio.start(manifest, time);
  playing = true;
  playOverlay.hidden = true;
  playBtn.textContent = "❚❚";
  sendStatus(true);
}

function pause() {
  playing = false;
  audio.stop();
  playBtn.textContent = "▶";
  if (manifest && !exporting) playOverlay.hidden = false;
  sendStatus(true);
}

function seek(t: number) {
  if (!manifest) return;
  time = Math.max(0, Math.min(t, manifest.totalDuration));
  if (playing) {
    perfStart = performance.now();
    perfFrom = time;
    if (audio.ctx.state === "running") audio.start(manifest, time);
  }
  renderer.render(time);
  sendStatus(true);
}

function sendStatus(force = false) {
  if (!manifest) return;
  const now = performance.now();
  if (!force && now - lastStatus < 120) return;
  lastStatus = now;
  const cap = captionAt(manifest, time);
  scrub.value = String(time);
  timeEl.textContent = `${formatTime(time)} / ${formatTime(manifest.totalDuration)}`;
  post({
    type: "FILM_STATUS",
    currentTime: time,
    totalDuration: manifest.totalDuration,
    isPlaying: playing,
    sceneIndex: sceneIndexAt(manifest, time),
    caption: cap ? { name: cap.name, text: cap.text } : null,
    muted: audio.isMuted,
  });
}

function frame() {
  if (manifest && playing) {
    time = clockNow();
    if (time >= manifest.totalDuration) {
      time = manifest.totalDuration;
      renderer.render(time);
      if (exporting) finishExport();
      else pause();
    }
  }
  if (manifest) {
    renderer.render(time);
    if (exporting) post({ type: "EXPORT_PROGRESS", progress: Math.round((time / manifest.totalDuration) * 100) });
    sendStatus();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- Export (real-time capture of the composited canvas + mixed audio) ---------------

let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let exportMime = "";

function pickMime(): string {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((c) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) || "";
}

async function startExport() {
  if (!manifest || exporting) return;
  exportMime = pickMime();
  if (!exportMime) {
    post({ type: "EXPORT_ERROR", error: "This browser cannot record video. Try Chrome or Edge." });
    return;
  }
  const audible = await audio.resume();
  if (!audible) {
    post({ type: "EXPORT_ERROR", error: "Press play once first so the browser allows sound, then export." });
    return;
  }
  pause();
  exporting = true;
  playOverlay.hidden = true;
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  renderer.setSize(1920, 1080);
  const stream = canvas.captureStream(30);
  audio.recordDestination.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  chunks = [];
  recorder = new MediaRecorder(stream, { mimeType: exportMime, videoBitsPerSecond: 8_000_000 });
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: exportMime.split(";")[0] });
    const ext = exportMime.startsWith("video/mp4") ? "mp4" : "webm";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(manifest?.title || "dream").replace(/[^\w\- ]+/g, "").trim() || "dream"}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    post({ type: "EXPORT_COMPLETE", format: ext });
  };
  time = 0;
  recorder.start(1000);
  await play();
  setStatus("Recording your film…");
}

function finishExport() {
  exporting = false;
  playing = false;
  audio.stop();
  recorder?.stop();
  recorder = null;
  setStatus(null);
  resize();
  playOverlay.hidden = false;
}

// ---- Wiring --------------------------------------------------------------------------

playOverlay.addEventListener("click", () => void play());
playBtn.addEventListener("click", () => (playing ? pause() : void play()));
scrub.addEventListener("input", () => seek(parseFloat(scrub.value)));
canvas.addEventListener("click", () => {
  if (exporting) return;
  if (playing) pause();
  else void play();
});

window.addEventListener("message", (event: MessageEvent) => {
  if (event.origin !== window.location.origin) return; // only the hosting app may drive the player
  const data = event.data;
  if (!data || typeof data !== "object") return;
  switch (data.type) {
    case "LOAD_FILM":
      if (data.manifest?.version === 2) void loadFilm(data.manifest as FilmManifest);
      break;
    case "PLAY":
      void play();
      break;
    case "PAUSE":
      pause();
      break;
    case "SEEK":
      if (typeof data.time === "number") seek(data.time);
      break;
    case "SET_MUTED":
      audio.setMuted(!!data.muted);
      sendStatus(true);
      break;
    case "EXPORT":
      void startExport();
      break;
  }
});

const params = new URLSearchParams(window.location.search);
const manifestUrl = params.get("manifest");
if (manifestUrl && manifestUrl.startsWith("/")) {
  fetch(manifestUrl)
    .then((r) => r.json())
    .then((m) => loadFilm(m as FilmManifest))
    .catch(() => setStatus("Could not load that manifest."));
} else {
  setStatus(embedded ? "Waiting for your dream…" : "Open a dream from the theater to watch its film.");
}
post({ type: "FILM_PLAYER_READY" });
