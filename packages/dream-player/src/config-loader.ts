/**
 * Configuration and Style Presets for the Dream Player Spike
 * Maps directly to config/render.yaml and config/styles/nocturne_toon.yaml
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
  };
}

export const RENDER_CONFIG = {
  shots: {
    wide: {
      name: "Wide Establishing",
      fov: 42,
      distance: 9.5,
      height: 3.2,
      targetOffset: [0.0, 0.8, 0.0] as [number, number, number],
      drift: { speed: 0.0003, amplitudeX: 0.35, amplitudeY: 0.12 },
    },
    hero_low: {
      name: "Hero Low Angle",
      fov: 38,
      distance: 4.2,
      height: 0.6,
      targetOffset: [0.0, 1.1, 0.0] as [number, number, number],
      drift: { speed: 0.0004, amplitudeX: 0.15, amplitudeY: 0.08 },
    },
    close_up: {
      name: "Intimate Close-Up",
      fov: 32,
      distance: 2.2,
      height: 1.45,
      targetOffset: [0.0, 1.4, 0.0] as [number, number, number],
      drift: { speed: 0.0002, amplitudeX: 0.08, amplitudeY: 0.05 },
    },
    tracking: {
      name: "Dynamic Tracking",
      fov: 40,
      distance: 5.5,
      height: 1.8,
      targetOffset: [0.0, 0.9, 0.0] as [number, number, number],
      drift: { speed: 0.0005, amplitudeX: 0.25, amplitudeY: 0.1 },
    },
    dolly_in: {
      name: "Slow Dolly In",
      fov: 38,
      distance: 6.0,
      height: 1.5,
      targetOffset: [0.0, 1.0, 0.0] as [number, number, number],
      drift: { speed: 0.0006, amplitudeX: 0.05, amplitudeY: 0.05, dollyRate: -0.15 },
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

