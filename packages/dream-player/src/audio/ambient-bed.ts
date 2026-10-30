/**
 * Web Audio Ambient Soundscape & Sound Motifs
 * Synthesizes drones, wind, and clock ticking without any external audio files
 */

export class DreamAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private isInitialized = false;

  private isTickingActive = false;
  private lastTickTime = 0;

  constructor() {
    // Initialized lazily upon first user interaction to comply with browser autoplay policies
  }

  public init() {
    if (this.isInitialized) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.startDrone();
      this.startWind();
      this.isInitialized = true;
    } catch (e) {
      console.warn("Web Audio initialization skipped:", e);
    }
  }

  private startDrone() {
    if (!this.ctx || !this.masterGain) return;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(140, this.ctx.currentTime);

    // Two detuned low triangle oscillators (dreamy drone)
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = "triangle";
    this.osc1.frequency.setValueAtTime(55, this.ctx.currentTime); // A1

    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = "triangle";
    this.osc2.frequency.setValueAtTime(55.6, this.ctx.currentTime); // subtle binaural beat

    this.osc1.connect(filter);
    this.osc2.connect(filter);
    filter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);

    this.osc1.start();
    this.osc2.start();
  }

  private startWind() {
    if (!this.ctx || !this.masterGain) return;

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
    bandpass.frequency.setValueAtTime(450, this.ctx.currentTime);
    bandpass.Q.setValueAtTime(1.5, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.06, this.ctx.currentTime);

    whiteNoise.connect(bandpass);
    bandpass.connect(this.windGain);
    this.windGain.connect(this.masterGain);

    whiteNoise.start();
  }

  public setTicking(active: boolean) {
    this.isTickingActive = active;
  }

  public playTickCue() {
    if (!this.ctx || !this.masterGain) return;

    // Short wooden/clock tick chirp
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.025);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  public update(timeSeconds: number) {
    if (this.isTickingActive && this.ctx) {
      if (timeSeconds - this.lastTickTime >= 1.0) {
        this.playTickCue();
        this.lastTickTime = timeSeconds;
      }
    }
  }

  public getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  public isMuted = false;

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

  /**
   * Deterministically render the entire dream audio track offline into an AudioBuffer.
   * This is used by the MP4 video exporter so exported films have full sound.
   */
  public static async renderOfflineSoundscape(durationSeconds: number): Promise<AudioBuffer> {
    const sampleRate = 44100;
    const OfflineCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!OfflineCtxClass) {
      throw new Error("OfflineAudioContext not supported in this browser");
    }

    const offlineCtx = new OfflineCtxClass(2, Math.ceil(sampleRate * durationSeconds), sampleRate);

    const masterGain = offlineCtx.createGain();
    masterGain.gain.setValueAtTime(0.35, 0);
    masterGain.connect(offlineCtx.destination);

    // 1. Ambient low resonant drone
    const droneGain = offlineCtx.createGain();
    droneGain.gain.setValueAtTime(0.18, 0);

    const filter = offlineCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(140, 0);

    const osc1 = offlineCtx.createOscillator();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(55, 0); // A1

    const osc2 = offlineCtx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(55.6, 0); // subtle binaural beat

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(masterGain);

    osc1.start(0);
    osc2.start(0);
    osc1.stop(durationSeconds);
    osc2.stop(durationSeconds);

    // 2. Wind noise
    const bufferSize = sampleRate * 2;
    const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
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
    windGain.connect(masterGain);

    whiteNoise.start(0);
    whiteNoise.stop(durationSeconds);

    // 3. Clock ticking cues during Scene 2 & Scene 3 (12.0s to 32.0s)
    for (let t = 12.0; t < 32.0; t += 1.0) {
      if (t + 0.05 > durationSeconds) break;
      const tickOsc = offlineCtx.createOscillator();
      const tickGain = offlineCtx.createGain();

      tickOsc.type = "sine";
      tickOsc.frequency.setValueAtTime(1200, t);
      tickOsc.frequency.exponentialRampToValueAtTime(320, t + 0.025);

      tickGain.gain.setValueAtTime(0.15, t);
      tickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

      tickOsc.connect(tickGain);
      tickGain.connect(masterGain);

      tickOsc.start(t);
      tickOsc.stop(t + 0.04);
    }

    // 4. Spoken voice track at t = 14.6s ("The tide is rising, but none of the clocks have hands.")
    try {
      const resp = await fetch("/audio/speech_spike.wav");
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const speechAudioBuf = await offlineCtx.decodeAudioData(arrayBuf);
        const speechSource = offlineCtx.createBufferSource();
        speechSource.buffer = speechAudioBuf;

        const speechGain = offlineCtx.createGain();
        speechGain.gain.setValueAtTime(0.9, 14.6);
        speechSource.connect(speechGain);
        speechGain.connect(masterGain);

        speechSource.start(14.6);
      }
    } catch (e) {
      console.warn("Could not load /audio/speech_spike.wav for offline render:", e);
    }

    return await offlineCtx.startRendering();
  }
}

