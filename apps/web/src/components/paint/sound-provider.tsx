"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from "react";

interface SoundContextValue {
  soundEnabled: boolean;
  toggleSound: () => void;
  playBalloonWhoosh: () => void;
  playSplashBrushWash: () => void;
  playWaterDrop: () => void;
  playMilestoneChime: () => void;
}

const SoundContext = createContext<SoundContextValue>({
  soundEnabled: false,
  toggleSound: () => {},
  playBalloonWhoosh: () => {},
  playSplashBrushWash: () => {},
  playWaterDrop: () => {},
  playMilestoneChime: () => {},
});

export function useSoundContext() {
  return useContext(SoundContext);
}

const STORAGE_KEY = "theatre_sound_enabled";
const MASTER_VOLUME = 0.35; // 35% master volume per design.md §19

export function SoundProvider({ children }: { children: ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);

  // Initialize persisted setting
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "true") {
        setSoundEnabled(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Helper to ensure AudioContext exists and is running
  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;

    if (!audioCtxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.setValueAtTime(MASTER_VOLUME, ctx.currentTime);
      master.connect(ctx.destination);

      audioCtxRef.current = ctx;
      masterGainRef.current = master;

      // Pre-synthesize 2 seconds of pure white noise buffer for whoosh/brush wash
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      noiseBufferRef.current = noiseBuffer;
    }

    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }

    return audioCtxRef.current;
  }, []);

  // Auto-mute on tab hidden (design.md §19)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!audioCtxRef.current) return;
      if (document.hidden) {
        audioCtxRef.current.suspend().catch(() => {});
      } else if (soundEnabled) {
        audioCtxRef.current.resume().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [soundEnabled]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      if (next) {
        const ctx = getAudioContext();
        if (ctx && ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
      } else if (audioCtxRef.current) {
        audioCtxRef.current.suspend().catch(() => {});
      }
      return next;
    });
  }, [getAudioContext]);

  // CUE 1: Short noise-sweep whoosh for balloon flight (~0.35s, ~-26dB)
  const playBalloonWhoosh = useCallback(() => {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx || !masterGainRef.current || !noiseBufferRef.current) return;

    try {
      const now = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBufferRef.current;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.setValueAtTime(3.0, now);
      filter.frequency.setValueAtTime(350, now);
      filter.frequency.exponentialRampToValueAtTime(1100, now + 0.18);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.36);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.15); // ~-26dB
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGainRef.current);

      noise.start(now);
      noise.stop(now + 0.37);
    } catch {
      // Ignore audio synthesis errors
    }
  }, [soundEnabled, getAudioContext]);

  // CUE 2: Water drop on pop (Sine 880 to 440 Hz over 120 ms, exp decay, -24 dB)
  const playWaterDrop = useCallback(() => {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx || !masterGainRef.current) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);

      gain.gain.setValueAtTime(0.063, now); // ~-24 dB
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

      osc.connect(gain);
      gain.connect(masterGainRef.current);

      osc.start(now);
      osc.stop(now + 0.14);
    } catch {
      // Ignore audio errors
    }
  }, [soundEnabled, getAudioContext]);

  // CUE 3: Brush wash on splash (Band-passed noise swelling over 1.2s, -28 dB)
  const playSplashBrushWash = useCallback(() => {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx || !masterGainRef.current || !noiseBufferRef.current) return;

    try {
      const now = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBufferRef.current;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.setValueAtTime(1.8, now);
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.linearRampToValueAtTime(950, now + 0.4);
      filter.frequency.exponentialRampToValueAtTime(320, now + 1.2);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.04, now + 0.25); // ~-28 dB
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGainRef.current);

      noise.start(now);
      noise.stop(now + 1.22);
    } catch {
      // Ignore audio errors
    }
  }, [soundEnabled, getAudioContext]);

  // CUE 4: Chime when chapter reaches 70% (Two sines 660 & 990 Hz, 1.8s decay, -22 dB)
  const playMilestoneChime = useCallback(() => {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx || !masterGainRef.current) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator(); // Soft sub-harmonic at 330 Hz
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(660, now);
      osc1.detune.setValueAtTime(4, now); // +4 cents

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(990, now);
      osc2.detune.setValueAtTime(-4, now); // -4 cents

      osc3.type = "sine";
      osc3.frequency.setValueAtTime(330, now);

      gain.gain.setValueAtTime(0.08, now); // ~-22 dB
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc1.connect(gain);
      osc2.connect(gain);
      osc3.connect(gain);
      gain.connect(masterGainRef.current);

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);
      osc1.stop(now + 1.85);
      osc2.stop(now + 1.85);
      osc3.stop(now + 1.85);
    } catch {
      // Ignore audio errors
    }
  }, [soundEnabled, getAudioContext]);

  return (
    <SoundContext.Provider
      value={{
        soundEnabled,
        toggleSound,
        playBalloonWhoosh,
        playSplashBrushWash,
        playWaterDrop,
        playMilestoneChime,
      }}
    >
      {children}
    </SoundContext.Provider>
  );
}

