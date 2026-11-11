/**
 * Web Audio Ambient Soundscape & Sound Motifs.
 * Synthesizes drones, wind beds, sub-bass, and sound motifs without external audio files.
 * Supports automated speech ducking and ambient presets.
 */

export class DreamAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private isInitialized = false;

  public isMuted = true;
  private isDucking = false;
  private currentPreset = "forest_whisper";
  private isTickingActive = false;
  private lastTickTime = 0;

  constructor() {
    this.isMuted = true;
  }

  public init() {
    if (this.isInitialized) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0.0 : 0.18, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);

      this.startDrone();
      this.startWind();
      this.isInitialized = true;
    } catch (e) {
      console.warn("Web Audio initialization skipped:", e);
    }
  }

  private startDrone() {
    if (!this.ctx || !this.ambientGain) return;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = "lowpass";
    this.filterNode.frequency.setValueAtTime(75, this.ctx.currentTime);

    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = "sine";
    this.osc1.frequency.setValueAtTime(55.0, this.ctx.currentTime); // A1

    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = "sine";
    this.osc2.frequency.setValueAtTime(82.4, this.ctx.currentTime); // E2 soft harmonic fifth

    this.osc1.connect(this.filterNode);
    this.osc2.connect(this.filterNode);
    this.filterNode.connect(this.droneGain);
    this.droneGain.connect(this.ambientGain);

    this.osc1.start();
    this.osc2.start();
  }

  private startWind() {
    if (!this.ctx || !this.ambientGain) return;

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(320, this.ctx.currentTime);
    bandpass.Q.setValueAtTime(0.8, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.015, this.ctx.currentTime);

    whiteNoise.connect(bandpass);
    bandpass.connect(this.windGain);
    this.windGain.connect(this.ambientGain);

    whiteNoise.start();
  }

  public setAmbientPreset(preset: string) {
    if (!this.ctx || !this.filterNode || this.currentPreset === preset) return;
    this.currentPreset = preset;
    const now = this.ctx.currentTime;

    switch (preset) {
      case "underwater_hum":
        this.filterNode.frequency.exponentialRampToValueAtTime(80, now + 1.2);
        if (this.droneGain) this.droneGain.gain.setValueAtTime(0.28, now);
        if (this.windGain) this.windGain.gain.setValueAtTime(0.02, now);
        break;
      case "wind_howl":
        this.filterNode.frequency.exponentialRampToValueAtTime(320, now + 1.2);
        if (this.windGain) this.windGain.gain.setValueAtTime(0.12, now);
        break;
      case "void_resonance":
        this.filterNode.frequency.exponentialRampToValueAtTime(65, now + 1.2);
        if (this.osc1) this.osc1.frequency.setValueAtTime(43.6, now); // F0
        break;
      case "institutional_drone":
        this.filterNode.frequency.exponentialRampToValueAtTime(120, now + 1.2);
        if (this.osc1) this.osc1.frequency.setValueAtTime(60, now); // 60Hz hum
        break;
      default: // forest_whisper
        this.filterNode.frequency.exponentialRampToValueAtTime(160, now + 1.2);
        if (this.droneGain) this.droneGain.gain.setValueAtTime(0.16, now);
        if (this.windGain) this.windGain.gain.setValueAtTime(0.05, now);
        break;
    }
  }

  public setSpeechDucking(active: boolean) {
    if (!this.ctx || !this.ambientGain || this.isDucking === active) return;
    this.isDucking = active;
    const now = this.ctx.currentTime;
    const targetGain = active ? 0.45 : 1.0; // -7 dB ducking
    this.ambientGain.gain.linearRampToValueAtTime(targetGain, now + 0.35);
  }

  public setTicking(active: boolean) {
    this.isTickingActive = active;
  }

  public setMotif(motif: string | null) {
    this.isTickingActive = motif === "ticking";
  }

  public playMotifCue(motif: string) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    if (motif === "ticking") {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.025);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (motif === "bell_chime") {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now); // A5
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 1.9);
    }
  }

  public update(timeSeconds: number) {
    if (this.isTickingActive && this.ctx && !this.isMuted) {
      if (timeSeconds - this.lastTickTime >= 1.0) {
        this.playMotifCue("ticking");
        this.lastTickTime = timeSeconds;
      }
    }
  }

  public getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.init();
    this.resume();
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const targetGain = this.isMuted ? 0.0 : 0.35;
      this.masterGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public static async renderOfflineSoundscape(durationSeconds: number): Promise<AudioBuffer> {
    const sampleRate = 48000;
    const length = Math.ceil(durationSeconds * sampleRate);
    const OfflineCtxClass =
      window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    const offlineCtx = new OfflineCtxClass(2, Math.max(1, length), sampleRate);

    // Drone
    const droneGain = offlineCtx.createGain();
    droneGain.gain.setValueAtTime(0.2, 0);

    const filterNode = offlineCtx.createBiquadFilter();
    filterNode.type = "lowpass";
    filterNode.frequency.setValueAtTime(140, 0);

    const osc1 = offlineCtx.createOscillator();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(55, 0);

    const osc2 = offlineCtx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(55.6, 0);

    osc1.connect(filterNode);
    osc2.connect(filterNode);
    filterNode.connect(droneGain);
    droneGain.connect(offlineCtx.destination);

    // Wind
    const noiseBufferSize = sampleRate * 2;
    const noiseBuffer = offlineCtx.createBuffer(1, noiseBufferSize, sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = offlineCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const bandpass = offlineCtx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(450, 0);
    bandpass.Q.setValueAtTime(1.5, 0);

    const windGain = offlineCtx.createGain();
    windGain.gain.setValueAtTime(0.06, 0);

    whiteNoise.connect(bandpass);
    bandpass.connect(windGain);
    windGain.connect(offlineCtx.destination);

    osc1.start(0);
    osc2.start(0);
    whiteNoise.start(0);

    return await offlineCtx.startRendering();
  }
}
