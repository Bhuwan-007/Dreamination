"""
Procedural Ambient Soundbed and Sound Motif Generator.
Conforms to Architecture.md §6.6 and Prompts.md P7.
Synthesizes immersive binaural drones, wind noise, and sound motifs using NumPy and SciPy.
Supports automated speech ducking (-7dB attenuation during vocal intervals).
Zero-cost, 100% offline, lightweight.
"""

from __future__ import annotations

import io
import math
import struct
import wave
from pathlib import Path
from typing import Any

import numpy as np

from .storage_paths import storage_dir

AMBIENT_STORAGE_DIR = storage_dir("ambient")


def _generate_noise(samples: int, noise_type: str = "pink") -> np.ndarray:
    """Generates normalized audio noise (white or pink)."""
    white = np.random.uniform(-1.0, 1.0, samples)
    if noise_type == "white":
        return white

    # Pink noise 1/f filter approximation (Paul Kellet's filter)
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0
    pink = np.zeros(samples, dtype=np.float32)
    for i in range(samples):
        w = white[i]
        b0 = 0.99886 * b0 + w * 0.0555179
        b1 = 0.99332 * b1 + w * 0.0750759
        b2 = 0.96900 * b2 + w * 0.1538520
        b3 = 0.86650 * b3 + w * 0.3104856
        b4 = 0.55000 * b4 + w * 0.5329522
        b5 = -0.7616 * b5 - w * 0.0168980
        pink[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362
        b6 = w * 0.115926

    # Normalize
    max_val = np.max(np.abs(pink)) or 1.0
    return pink / max_val


def synthesize_ambient_soundbed(
    duration: float,
    preset: str = "forest_whisper",
    motif: str | None = None,
    speech_intervals: list[tuple[float, float]] | None = None,
    sample_rate: int = 48000,
) -> tuple[bytes, float]:
    """
    Synthesizes a complete stereo 16-bit WAV ambient track with speech ducking.
    """
    num_samples = int(math.ceil(duration * sample_rate))
    time_axis = np.linspace(0, duration, num_samples, endpoint=False, dtype=np.float32)

    left_channel = np.zeros(num_samples, dtype=np.float32)
    right_channel = np.zeros(num_samples, dtype=np.float32)

    # 1. Base Bed by Preset
    if preset == "underwater_hum":
        # Deep sub-bass 52Hz + binaural 52.8Hz + lowpass rumble
        sub_left = np.sin(2 * np.pi * 52.0 * time_axis) * 0.28
        sub_right = np.sin(2 * np.pi * 52.8 * time_axis) * 0.28
        noise = _generate_noise(num_samples, "pink") * 0.06
        # Slow filter sweep modulation
        mod = (np.sin(2 * np.pi * 0.12 * time_axis) + 1.0) * 0.5
        left_channel += sub_left + noise * mod
        right_channel += sub_right + noise * (1.0 - mod)

    elif preset == "wind_howl":
        # Sweeping howling resonance over pink noise
        noise = _generate_noise(num_samples, "pink")
        wind_mod = np.sin(2 * np.pi * 0.25 * time_axis) * 0.5 + 0.5
        # Whistle tone
        whistle_freq = 320.0 + 80.0 * np.sin(2 * np.pi * 0.15 * time_axis)
        whistle = np.sin(2 * np.pi * whistle_freq * time_axis) * 0.08 * wind_mod
        left_channel += noise * 0.12 * wind_mod + whistle
        right_channel += noise * 0.12 * (1.0 - wind_mod) + whistle * 0.9

    elif preset == "void_resonance":
        # Binaural 55.0Hz & 55.6Hz triangle-like sub-drone + cavern reverb wash
        drone_l = (
            np.sin(2 * np.pi * 55.0 * time_axis) * 0.25
            + np.sin(2 * np.pi * 110.0 * time_axis) * 0.08
        )
        drone_r = (
            np.sin(2 * np.pi * 55.6 * time_axis) * 0.25
            + np.sin(2 * np.pi * 111.2 * time_axis) * 0.08
        )
        sub = np.sin(2 * np.pi * 27.5 * time_axis) * 0.15
        left_channel += drone_l + sub
        right_channel += drone_r + sub

    elif preset == "institutional_drone":
        # Cold 60Hz hum + upper harmonics (120Hz, 180Hz) + faint high fluorescent sizzle
        mains_l = (
            np.sin(2 * np.pi * 60.0 * time_axis) * 0.2
            + np.sin(2 * np.pi * 120.0 * time_axis) * 0.06
            + np.sin(2 * np.pi * 180.0 * time_axis) * 0.03
        )
        mains_r = (
            np.sin(2 * np.pi * 60.2 * time_axis) * 0.2
            + np.sin(2 * np.pi * 120.4 * time_axis) * 0.06
            + np.sin(2 * np.pi * 180.6 * time_axis) * 0.03
        )
        sizzle = _generate_noise(num_samples, "white") * 0.015
        left_channel += mains_l + sizzle
        right_channel += mains_r + sizzle

    else:  # Default: forest_whisper
        # Soft canopy wind rustle (filtered pink noise) + warm 65Hz root chord
        noise = _generate_noise(num_samples, "pink") * 0.08
        root_l = np.sin(2 * np.pi * 65.4 * time_axis) * 0.14
        root_r = np.sin(2 * np.pi * 65.9 * time_axis) * 0.14
        left_channel += noise + root_l
        right_channel += noise + root_r

    # 2. Add Motif Cues
    if motif == "ticking":
        # Sharp click every 1.0s
        for t_sec in np.arange(0.5, duration, 1.0):
            idx = int(t_sec * sample_rate)
            click_len = int(0.03 * sample_rate)
            if idx + click_len < num_samples:
                click_t = np.linspace(0, 0.03, click_len, endpoint=False)
                click_wave = np.sin(2 * np.pi * 1200 * click_t) * np.exp(-click_t * 90.0) * 0.18
                left_channel[idx : idx + click_len] += click_wave
                right_channel[idx : idx + click_len] += click_wave

    elif motif == "bell_chime":
        # Metallic bell strike at t=0.8s with long 3.5s harmonic decay
        idx = int(0.8 * sample_rate)
        decay_sec = 3.5
        chime_len = min(int(decay_sec * sample_rate), num_samples - idx)
        if chime_len > 0:
            chime_t = np.linspace(0, chime_len / sample_rate, chime_len, endpoint=False)
            decay = np.exp(-chime_t * 1.4)
            # A5 (880Hz), C#6 (1108Hz), E6 (1320Hz), high sparkle (2640Hz)
            bell = (
                np.sin(2 * np.pi * 880 * chime_t) * 0.22
                + np.sin(2 * np.pi * 1108 * chime_t) * 0.12
                + np.sin(2 * np.pi * 1320 * chime_t) * 0.08
                + np.sin(2 * np.pi * 2640 * chime_t) * 0.03
            ) * decay
            left_channel[idx : idx + chime_len] += bell
            right_channel[idx : idx + chime_len] += bell * 0.85

    elif motif == "tide_rush":
        # Ocean wave swell every 5.0 seconds
        for t_sec in np.arange(1.0, duration, 5.0):
            idx = int(t_sec * sample_rate)
            swell_len = min(int(4.0 * sample_rate), num_samples - idx)
            if swell_len > 0:
                swell_t = np.linspace(0, 4.0, swell_len, endpoint=False)
                envelope = np.sin((swell_t / 4.0) * np.pi) ** 2 * 0.15
                swell_noise = _generate_noise(swell_len, "pink") * envelope
                left_channel[idx : idx + swell_len] += swell_noise
                right_channel[idx : idx + swell_len] += swell_noise

    # 3. Apply Speech Ducking (-7dB attenuation ~= factor of 0.45)
    ducking_envelope = np.ones(num_samples, dtype=np.float32)
    if speech_intervals:
        ramp_samples = int(0.18 * sample_rate)  # 180ms crossfade
        for start_t, end_t in speech_intervals:
            s_idx = max(0, int(start_t * sample_rate))
            e_idx = min(num_samples, int(end_t * sample_rate))
            if s_idx >= e_idx:
                continue

            # Ramp down
            ramp_down_end = min(e_idx, s_idx + ramp_samples)
            if ramp_down_end > s_idx:
                rd_len = ramp_down_end - s_idx
                ducking_envelope[s_idx:ramp_down_end] = np.linspace(1.0, 0.45, rd_len)

            # Ducked body
            if e_idx > ramp_down_end:
                ducking_envelope[ramp_down_end:e_idx] = 0.45

            # Ramp up
            ramp_up_end = min(num_samples, e_idx + ramp_samples)
            if ramp_up_end > e_idx:
                ru_len = ramp_up_end - e_idx
                ducking_envelope[e_idx:ramp_up_end] = np.linspace(0.45, 1.0, ru_len)

    left_channel *= ducking_envelope
    right_channel *= ducking_envelope

    # 4. Master Limiter / Normalizer to prevent clipping
    peak = max(np.max(np.abs(left_channel)), np.max(np.abs(right_channel)))
    if peak > 0.95:
        left_channel = (left_channel / peak) * 0.95
        right_channel = (right_channel / peak) * 0.95

    # 5. Pack into 16-bit stereo interleaved WAV
    left_int16 = (left_channel * 32767).astype(np.int16)
    right_int16 = (right_channel * 32767).astype(np.int16)

    interleaved = np.empty((num_samples * 2,), dtype=np.int16)
    interleaved[0::2] = left_int16
    interleaved[1::2] = right_int16

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(2)  # Stereo
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(interleaved.tobytes())

    return buf.getvalue(), duration


def generate_ambient_track(
    dream_id: str,
    duration: float,
    preset: str = "forest_whisper",
    motif: str | None = None,
    speech_intervals: list[tuple[float, float]] | None = None,
) -> str:
    """
    Generates and saves ambient track to data/storage/ambient/{dream_id}_ambient.wav.
    Returns relative web URL /storage/ambient/{dream_id}_ambient.wav.
    """
    filename = f"{dream_id}_ambient.wav"
    target_path = AMBIENT_STORAGE_DIR / filename

    wav_bytes, _ = synthesize_ambient_soundbed(
        duration=duration,
        preset=preset,
        motif=motif,
        speech_intervals=speech_intervals,
    )

    with open(target_path, "wb") as f:
        f.write(wav_bytes)

    return f"/storage/ambient/{filename}"

