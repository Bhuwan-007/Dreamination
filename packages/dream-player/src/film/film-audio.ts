/**
 * Web Audio playback for films: every speech line and ambient bed is a decoded buffer
 * scheduled against the AudioContext clock, so seeking, pausing and export stay in sync.
 */
import type { FilmManifest } from "./types";

export class FilmAudio {
  public readonly ctx: AudioContext;
  public readonly recordDestination: MediaStreamAudioDestinationNode;
  private master: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private sources: AudioBufferSourceNode[] = [];
  private startedAtCtx = 0;
  private startedAtFilm = 0;
  private running = false;
  private muted = false;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.recordDestination = this.ctx.createMediaStreamDestination();
    this.master.connect(this.recordDestination);
  }

  async load(m: FilmManifest, onProgress?: (k: number) => void): Promise<void> {
    const urls = new Set<string>();
    for (const s of m.scenes) {
      if (s.ambientUrl) urls.add(s.ambientUrl);
      for (const sp of s.speeches) if (sp.audioUrl) urls.add(sp.audioUrl);
    }
    let done = 0;
    await Promise.all(
      [...urls].map(async (url) => {
        if (!this.buffers.has(url)) {
          try {
            const res = await fetch(url);
            if (res.ok) this.buffers.set(url, await this.ctx.decodeAudioData(await res.arrayBuffer()));
          } catch {
            /* a missing sound never blocks the film */
          }
        }
        done += 1;
        onProgress?.(done / Math.max(1, urls.size));
      })
    );
  }

  get isRunning() {
    return this.running;
  }

  /** Current film time while running. */
  now(): number {
    return this.startedAtFilm + (this.ctx.currentTime - this.startedAtCtx);
  }

  async resume(): Promise<boolean> {
    if (this.ctx.state !== "running") {
      try {
        await this.ctx.resume();
      } catch {
        /* needs a user gesture */
      }
    }
    return this.ctx.state === "running";
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.master.gain.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime);
  }

  get isMuted() {
    return this.muted;
  }

  start(m: FilmManifest, fromT: number) {
    this.stop();
    const lead = 0.06;
    const now = this.ctx.currentTime + lead;
    this.startedAtCtx = now;
    this.startedAtFilm = fromT;
    this.running = true;

    const play = (url: string | undefined, start: number, end: number, gain: number, fade = 0) => {
      if (!url) return;
      const buf = this.buffers.get(url);
      if (!buf || end <= fromT) return;
      const offset = Math.max(0, fromT - start);
      if (offset >= buf.duration) return;
      const when = now + Math.max(0, start - fromT);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(fade > 0 ? 0 : gain, when);
      if (fade > 0) g.gain.linearRampToValueAtTime(gain, when + fade);
      const stopAt = when + Math.min(buf.duration - offset, end - Math.max(start, fromT));
      if (fade > 0) {
        g.gain.setValueAtTime(gain, Math.max(when + fade, stopAt - fade));
        g.gain.linearRampToValueAtTime(0, stopAt);
      }
      src.connect(g).connect(this.master);
      src.start(when, offset);
      src.stop(stopAt + 0.02);
      this.sources.push(src);
    };

    for (const s of m.scenes) {
      play(s.ambientUrl, s.startTime, s.endTime + 0.6, 0.55, 0.8);
      for (const sp of s.speeches) play(sp.audioUrl, sp.startTime, sp.startTime + sp.duration + 0.5, 1.0);
    }
  }

  stop() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];
    this.running = false;
  }
}
