/**
 * Configuration and Style Presets for the Dream Player.
 * Maps directly to config/render.yaml and config/styles/nocturne_toon.yaml.
 */

export interface ShotPreset {
  name: string;
  fov: number;
  distance: number;
  height: number;
  targetOffset: [number, number, number];
  drift: {
    speed: number;
    amplitudeX: number;
    amplitudeY: number;
    dollyRate?: number;
    orbitSpeed?: number;
  };
  description?: string;
}

export const RENDER_CONFIG = {
  profiles: {
    preview: {
      resolution: [1920, 1080] as [number, number],
      targetFps: 60,
      dprCap: 1.5,
      antialias: true,
      powerPreference: "high-performance" as const,
    },
    export: {
      resolution: [1920, 1080] as [number, number],
      targetFps: 30,
      fixedTimestep: 1 / 30,
      videoBitrate: 8_000_000,
      audioSampleRate: 44100,
      format: "mp4" as const,
    },
  },
  shots: {
    wide: {
      name: "Wide Establishing",
      fov: 42,
      distance: 9.5,
      height: 3.2,
      targetOffset: [0.0, 0.8, 0.0],
      drift: { speed: 0.0003, amplitudeX: 0.35, amplitudeY: 0.12 },
      description: "Vast landscape shot dwarfing the traveler against the horizon.",
    },
    two_shot: {
      name: "Two Shot Dialogue",
      fov: 38,
      distance: 5.0,
      height: 1.6,
      targetOffset: [0.0, 1.2, 0.0],
      drift: { speed: 0.0003, amplitudeX: 0.12, amplitudeY: 0.06 },
      description: "Medium framing balancing two interlocutors or character and key focal prop.",
    },
    close_up: {
      name: "Intimate Close-Up",
      fov: 32,
      distance: 2.2,
      height: 1.45,
      targetOffset: [0.0, 1.4, 0.0],
      drift: { speed: 0.0002, amplitudeX: 0.08, amplitudeY: 0.05 },
      description: "Focused view on the traveler's face and visemes.",
    },
    hero_low: {
      name: "Hero Low Angle",
      fov: 38,
      distance: 4.2,
      height: 0.6,
      targetOffset: [0.0, 1.1, 0.0],
      drift: { speed: 0.0004, amplitudeX: 0.15, amplitudeY: 0.08 },
      description: "Low-angle cinematic framing looking up at the traveler.",
    },
    over_shoulder: {
      name: "Over The Shoulder",
      fov: 35,
      distance: 2.8,
      height: 1.6,
      targetOffset: [0.4, 1.3, 0.0],
      drift: { speed: 0.0003, amplitudeX: 0.1, amplitudeY: 0.06 },
      description: "Subject framed past an occluding shoulder or doorway edge.",
    },
    top_down: {
      name: "Top-Down God's Eye",
      fov: 45,
      distance: 8.5,
      height: 8.0,
      targetOffset: [0.0, 0.0, 0.0],
      drift: { speed: 0.0002, amplitudeX: 0.1, amplitudeY: 0.1 },
      description: "Overhead plan view emphasizing labyrinthine floor patterns and geometry.",
    },
    dolly_in: {
      name: "Slow Dolly In",
      fov: 38,
      distance: 6.0,
      height: 1.5,
      targetOffset: [0.0, 1.0, 0.0],
      drift: { speed: 0.0006, amplitudeX: 0.05, amplitudeY: 0.05, dollyRate: -0.15 },
      description: "Forward creeping camera intensifying psychological suspense.",
    },
    tracking: {
      name: "Dynamic Tracking",
      fov: 40,
      distance: 5.5,
      height: 1.8,
      targetOffset: [0.0, 0.9, 0.0],
      drift: { speed: 0.0005, amplitudeX: 0.25, amplitudeY: 0.1 },
      description: "Lateral tracking alongside character locomotion.",
    },
    orbit: {
      name: "Dream Orbit",
      fov: 36,
      distance: 4.5,
      height: 1.7,
      targetOffset: [0.0, 1.1, 0.0],
      drift: { speed: 0.0004, amplitudeX: 0.2, amplitudeY: 0.1, orbitSpeed: 0.18 },
      description: "Slow 360-degree rotational drift revealing surrounding surreal space.",
    },
  } as Record<string, ShotPreset>,
};

export const NOCTURNE_STYLE = {
  id: "nocturne_toon",
  palette: {
    void: 0x090d11,
    forestNight: 0x0c1c17,
    slate: 0x151a1e,
    graphite: 0x282e31,
    ash: 0x4b5151,
    cloud: 0xe9eaeb,
    mist: 0xbdcebc,
    sage: 0x77917f,
    lantern: 0xe2b866,
    lanternSoft: 0xf3dda6,
    viridian: 0x437666,
    water: 0x17415c,
    lake: 0x559ca9,
    duskRose: 0xc9747c,
  },
  fog: {
    color: 0x0c1c17,
    density: 0.035,
  },
  lighting: {
    ambientColor: 0x1b2a4a,
    ambientIntensity: 0.65,
    keyColor: 0xe2b866,
    keyIntensity: 1.4,
    keyPos: [4.0, 6.0, 3.0] as [number, number, number],
    fillColor: 0x559ca9,
    fillIntensity: 0.35,
  },
  sky: {
    starCount: 350,
    starColor: 0xf3dda6,
    haloColor: 0xe2b866,
  },
};
