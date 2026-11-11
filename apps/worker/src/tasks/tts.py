"""
TTS Generation and Word/Viseme Timing Service.
Conforms to Architecture.md §6.6 and §9, Prompt P7.
Generates speech audio assets and deterministic word-level viseme arrays.
Zero-cost, lightweight, 100% offline capable with local caching.
"""

from __future__ import annotations

import hashlib
import io
import math
import struct
import wave
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from .storage_paths import storage_dir

TTS_STORAGE_DIR = storage_dir("tts")


class WordTiming(BaseModel):
    word: str
    start: float
    end: float
    viseme: str = "neutral"


class TTSOutput(BaseModel):
    audio_url: str
    duration: float
    word_timings: list[WordTiming]


def _detect_dominant_viseme(word: str) -> str:
    """
    Maps english orthography/phonemes to 3D avatar viseme morph targets:
    ['aa', 'E', 'I', 'O', 'U', 'neutral']
    """
    clean = word.lower().strip(".,!?:;\"'()")
    if not clean:
        return "neutral"

    # Check for strong vowel phoneme markers
    if any(p in clean for p in ("oo", "ou", "ew", "ui")):
        return "U"
    if any(p in clean for p in ("o", "oa", "ow", "au", "aw")):
        return "O"
    if any(p in clean for p in ("ee", "ea", "ey", "ie")):
        return "E"
    if any(p in clean for p in ("i", "igh", "y", "ai")):
        return "I"
    if any(p in clean for p in ("a", "ah", "ar")):
        return "aa"

    return "neutral"


def _synthesize_procedural_speech(
    text: str,
    pitch_base: float = 125.0,
    sample_rate: int = 24000,
) -> tuple[bytes, float, list[WordTiming]]:
    """
    Lightweight, completely offline formant voice synthesizer.
    Generates 16-bit PCM WAV audio with pitch contours and word boundaries.
    Ensures zero cloud cost ($0.00) and zero Docker memory overhead.
    """
    words = [w for w in text.split() if w.strip()]
    if not words:
        words = ["..."]

    timings: list[WordTiming] = []
    cursor = 0.25  # Initial breathing pause

    # Approximate syllable count for pacing
    total_audio_samples = []

    # Initial silence
    silence_samples = int(cursor * sample_rate)
    total_audio_samples.extend([0] * silence_samples)

    for i, raw_word in enumerate(words):
        viseme = _detect_dominant_viseme(raw_word)
        char_count = len(raw_word)
        # Word duration: roughly 0.28s to 0.45s depending on length
        word_dur = max(0.24, min(0.65, char_count * 0.055 + 0.18))
        word_start = cursor
        word_end = cursor + word_dur
        timings.append(WordTiming(
            word=raw_word,
            start=round(word_start, 3),
            end=round(word_end, 3),
            viseme=viseme,
        ))

        # Synthesize word waveform using harmonic formant synthesis
        word_samples_count = int(word_dur * sample_rate)
        # Pitch intonation contour (slight rise-fall across sentence)
        progress = i / max(1, len(words) - 1)
        sentence_inflection = math.sin(progress * math.pi) * 12.0
        pitch = pitch_base + sentence_inflection

        # Formant frequencies based on viseme
        if viseme == "aa":
            f1, f2 = 730, 1090
        elif viseme == "E":
            f1, f2 = 530, 1840
        elif viseme == "I":
            f1, f2 = 270, 2290
        elif viseme == "O":
            f1, f2 = 570, 840
        elif viseme == "U":
            f1, f2 = 300, 870
        else:
            f1, f2 = 500, 1500

        for s in range(word_samples_count):
            t = s / sample_rate
            # Attack and release envelope (Hamming-like)
            env = math.sin((s / word_samples_count) * math.pi) ** 1.2

            # Glottal pulse oscillator (fundamental + harmonics)
            phase = (t * pitch) % 1.0
            buzz = math.sin(2 * math.pi * phase) + 0.5 * math.sin(4 * math.pi * phase) + 0.25 * math.sin(6 * math.pi * phase)

            # Formant resonance approximation
            formant1 = math.sin(2 * math.pi * f1 * t) * 0.6
            formant2 = math.sin(2 * math.pi * f2 * t) * 0.4
            sample_val = buzz * (formant1 + formant2) * env * 0.32

            # Clamp to 16-bit integer
            int_val = int(max(-32767, min(32767, sample_val * 32767)))
            total_audio_samples.append(int_val)

        # Inter-word micro pause
        pause_dur = 0.08 if i < len(words) - 1 else 0.3
        pause_samples = int(pause_dur * sample_rate)
        total_audio_samples.extend([0] * pause_samples)
        cursor = word_end + pause_dur

    total_duration = len(total_audio_samples) / sample_rate

    # Write WAV binary
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        packed_frames = struct.pack(f"<{len(total_audio_samples)}h", *total_audio_samples)
        wav_file.writeframes(packed_frames)

    return buf.getvalue(), total_duration, timings


def generate_tts(
    text: str,
    voice: str = "traveler_neutral",
    emotion: str = "neutral",
) -> TTSOutput:
    """
    Generates TTS audio and word/viseme timings.
    Caches output by SHA256(text + voice + emotion).
    """
    cache_key = hashlib.sha256(f"{text}_{voice}_{emotion}".encode("utf-8")).hexdigest()[:16]
    target_filename = f"{cache_key}.wav"
    target_path = TTS_STORAGE_DIR / target_filename
    timings_path = TTS_STORAGE_DIR / f"{cache_key}_timings.json"

    pitch = 140.0 if "female" in voice else (110.0 if "narrator" in voice else 125.0)
    if emotion in ("fearful", "uneasy"):
        pitch += 12.0
    elif emotion in ("melancholic", "peaceful"):
        pitch -= 8.0

    if target_path.exists() and timings_path.exists():
        try:
            import json
            with open(timings_path, "r", encoding="utf-8") as f:
                saved_data = json.load(f)
            return TTSOutput(
                audio_url=f"/storage/tts/{target_filename}",
                duration=round(saved_data["duration"], 2),
                word_timings=[WordTiming(**w) for w in saved_data["words"]],
            )
        except Exception:
            pass  # Fall through to regenerate if corrupted

    wav_bytes, duration, timings = _synthesize_procedural_speech(text, pitch_base=pitch)
    duration_rounded = round(duration, 2)

    with open(target_path, "wb") as f:
        f.write(wav_bytes)

    import json
    with open(timings_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "duration": duration_rounded,
                "words": [w.model_dump() for w in timings],
            },
            f,
        )

    return TTSOutput(
        audio_url=f"/storage/tts/{target_filename}",
        duration=duration_rounded,
        word_timings=timings,
    )


# --------------------------------------------------------------------------------------
# Real speech ladder for films: Piper -> espeak-ng -> Windows SAPI -> formant fallback
# --------------------------------------------------------------------------------------

_SAPI_SCRIPT = r"""
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$want = $env:DREAM_TTS_GENDER
$voices = $s.GetInstalledVoices() | Where-Object { $_.Enabled }
$pick = $voices | Where-Object { $_.VoiceInfo.Gender -eq $want } | Select-Object -Index ([int]$env:DREAM_TTS_INDEX % [Math]::Max(1, ($voices | Where-Object { $_.VoiceInfo.Gender -eq $want }).Count))
if ($pick) { $s.SelectVoice($pick.VoiceInfo.Name) }
$s.Rate = [int]$env:DREAM_TTS_RATE
$s.SetOutputToWaveFile($env:DREAM_TTS_OUT)
$s.Speak($env:DREAM_TTS_TEXT)
$s.Dispose()
"""


def _wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / float(w.getframerate())


def _engine_order() -> list[str]:
    import os
    import shutil
    import sys

    forced = (os.getenv("TTS_ENGINE") or "").strip().lower()
    if forced:
        return [forced, "formant"]
    if os.getenv("PYTEST_CURRENT_TEST"):
        return ["formant"]
    order: list[str] = []
    if os.getenv("PIPER_MODEL") and (os.getenv("PIPER_BIN") or shutil.which("piper")):
        order.append("piper")
    if shutil.which("espeak-ng") or shutil.which("espeak"):
        order.append("espeak")
    if sys.platform == "win32":
        order.append("sapi")
    order.append("formant")
    return order


def _run_engine(engine: str, text: str, tone: str, rate: int, voice_index: int, out: Path) -> bool:
    import os
    import shutil
    import subprocess

    try:
        if engine == "piper":
            model = os.getenv(f"PIPER_MODEL_{tone.upper()}") or os.environ["PIPER_MODEL"]
            length = max(0.7, min(1.5, 1.0 - rate * 0.08))
            subprocess.run(
                [os.getenv("PIPER_BIN") or shutil.which("piper") or "piper", "--model", model,
                 "--output_file", str(out), "--length_scale", f"{length:.2f}"],
                input=text.encode("utf-8"), check=True, capture_output=True, timeout=60,
            )
        elif engine == "espeak":
            exe = shutil.which("espeak-ng") or shutil.which("espeak") or "espeak-ng"
            variant = {"low": "m3", "mid": "m1", "high": "f3"}.get(tone, "m1")
            pitch = {"low": 35, "mid": 50, "high": 68}.get(tone, 50) + (voice_index % 3) * 4
            speed = 150 + rate * 12
            subprocess.run([exe, "-v", f"en-us+{variant}", "-p", str(pitch), "-s", str(speed), "-w", str(out), text],
                           check=True, capture_output=True, timeout=60)
        elif engine == "sapi":
            env = dict(os.environ)
            env.update({
                "DREAM_TTS_TEXT": text,
                "DREAM_TTS_OUT": str(out.resolve()),
                "DREAM_TTS_GENDER": "Female" if tone == "high" or (tone == "mid" and voice_index % 2 == 1) else "Male",
                "DREAM_TTS_INDEX": str(voice_index),
                "DREAM_TTS_RATE": str(max(-10, min(10, rate - 1))),
            })
            subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", "-"],
                           input=_SAPI_SCRIPT.encode("utf-8"), env=env, check=True, capture_output=True, timeout=60)
        else:
            return False
        return out.exists() and out.stat().st_size > 1000
    except Exception:  # noqa: BLE001 - try the next engine
        return False


def _timings_for(text: str, duration: float) -> list[WordTiming]:
    words = [w for w in text.split() if w.strip()] or ["..."]
    lead, tail = 0.12, 0.15
    span = max(0.3, duration - lead - tail)
    weights = [len(w) + 2 for w in words]
    total = float(sum(weights))
    cursor = lead
    out: list[WordTiming] = []
    for w, wt in zip(words, weights):
        dur = span * wt / total
        out.append(WordTiming(word=w, start=round(cursor, 3), end=round(cursor + dur * 0.92, 3),
                              viseme=_detect_dominant_viseme(w)))
        cursor += dur
    return out


def speak_line(text: str, tone: str = "mid", rate: int = 0, voice_index: int = 0) -> TTSOutput:
    """Synthesise one spoken line with the best available real voice. Cached by content."""
    import json

    text = " ".join(text.split()) or "..."
    for engine in _engine_order():
        key = hashlib.sha256(f"{engine}|{tone}|{rate}|{voice_index}|{text}".encode("utf-8")).hexdigest()[:20]
        wav_path = TTS_STORAGE_DIR / f"line_{key}.wav"
        meta_path = TTS_STORAGE_DIR / f"line_{key}.json"
        if wav_path.exists() and meta_path.exists():
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            return TTSOutput(audio_url=f"/storage/tts/{wav_path.name}", duration=meta["duration"],
                             word_timings=[WordTiming(**w) for w in meta["words"]])
        if engine == "formant":
            pitch = {"low": 105.0, "mid": 125.0, "high": 175.0}.get(tone, 125.0)
            wav_bytes, duration, timings = _synthesize_procedural_speech(text, pitch_base=pitch)
            wav_path.write_bytes(wav_bytes)
        else:
            if not _run_engine(engine, text, tone, rate, voice_index, wav_path):
                wav_path.unlink(missing_ok=True)
                continue
            duration = _wav_duration(wav_path)
            timings = _timings_for(text, duration)
        duration = round(duration, 3)
        meta_path.write_text(json.dumps({"engine": engine, "duration": duration,
                                         "words": [w.model_dump() for w in timings]}), encoding="utf-8")
        return TTSOutput(audio_url=f"/storage/tts/{wav_path.name}", duration=duration, word_timings=timings)
    raise RuntimeError("No speech engine available")  # unreachable: formant always succeeds
