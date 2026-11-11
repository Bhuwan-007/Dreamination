"""
Phase 10.2 Unit Tests: Worker Asset Pipeline and Manifest Compiler.
Tests TTS synthesis, procedural ambient soundbeds, skybox textures, and manifest packaging.
"""

from __future__ import annotations

import json
import wave
from pathlib import Path

import pytest
from apps.worker.src.tasks.audio import (
    generate_ambient_track,
    synthesize_ambient_soundbed,
)
from apps.worker.src.tasks.render import compile_and_package_manifest
from apps.worker.src.tasks.textures import (
    SKY_PALETTES,
    generate_procedural_skybox,
    generate_skybox_texture,
)
from apps.worker.src.tasks.tts import (
    _detect_dominant_viseme,
    generate_tts,
)
from PIL import Image


def test_viseme_detector_mappings():
    assert _detect_dominant_viseme("moon") == "U"
    assert _detect_dominant_viseme("ocean") == "O"
    assert _detect_dominant_viseme("sea") == "E"
    assert _detect_dominant_viseme("sky") == "I"
    assert _detect_dominant_viseme("dark") == "aa"
    assert _detect_dominant_viseme("the") == "neutral"


def test_tts_generation_produces_valid_wav_and_timings():
    out = generate_tts("A bell is ringing across the lake.", voice="traveler", emotion="wonder")
    assert out.duration > 1.5
    assert len(out.word_timings) == 7
    assert out.audio_url.startswith("/storage/tts/")

    # Verify WAV file
    clean_path = Path("data") / out.audio_url.replace("/storage/", "storage/")
    assert clean_path.exists()

    with wave.open(str(clean_path), "rb") as wf:
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2
        assert wf.getframerate() == 24000
        frames = wf.getnframes()
        assert frames > 24000 * 1.5


def test_tts_cache_deterministic_reuse():
    out1 = generate_tts("Testing cache idempotency.", voice="narrator")
    out2 = generate_tts("Testing cache idempotency.", voice="narrator")
    assert out1.audio_url == out2.audio_url
    assert out1.duration == out2.duration


def test_ambient_soundbed_presets_and_motifs():
    presets = ["underwater_hum", "forest_whisper", "wind_howl", "void_resonance", "institutional_drone"]
    for preset in presets:
        wav_bytes, dur = synthesize_ambient_soundbed(duration=1.5, preset=preset)
        assert len(wav_bytes) > 1000
        assert dur == 1.5

    # Test motif
    wav_bytes_motif, _ = synthesize_ambient_soundbed(
        duration=2.0,
        preset="void_resonance",
        motif="bell_chime",
        speech_intervals=[(0.5, 1.2)],
    )
    assert len(wav_bytes_motif) > 1000


def test_skybox_texture_generation():
    for sky_name in SKY_PALETTES.keys():
        img = generate_procedural_skybox(sky_name=sky_name, width=512, height=256)
        assert isinstance(img, Image.Image)
        assert img.size == (512, 256)
        assert img.mode == "RGB"

    url = generate_skybox_texture(sky_name="ember_dawn")
    assert url.startswith("/storage/skyboxes/")
    file_path = Path("data") / url.replace("/storage/", "storage/")
    assert file_path.exists()


def test_compile_and_package_manifest_full_flow(tmp_path):
    mock_script = {
        "title": "The Glass Garden",
        "style_id": "nocturne_toon",
        "scenes": [
            {
                "scene_id": 1,
                "transition_in": "dissolve",
                "world": {
                    "kit": "forest",
                    "sky": "mist_teal",
                    "light": "moonlit",
                    "weather": "rain",
                    "props": [{"id": "ancient_trunk", "anchor": "moss_clearing"}],
                    "effects": [{"type": "float", "at": 1.0, "duration": 2.5}],
                },
                "cast": [{"name": "Traveler", "spawn": "origin", "face_visibility": "shadowed"}],
                "beats": [
                    {"t": 0.0, "actor": "camera", "action": "shot", "args": {"preset": "wide"}},
                    {"t": 0.5, "actor": "Traveler", "action": "speak", "args": {"line": "The trees are glowing."}},
                ],
                "narration": "Deep in the quiet canopy, light pooled like rain.",
                "ambient": "forest_whisper",
                "sound_motif": "ticking",
            }
        ],
    }

    progress_events = []

    def callback(stage, percent, meta):
        progress_events.append((stage, percent))
        # Rule 6 check: no raw text in meta
        meta_str = json.dumps(meta or {})
        assert "The trees are glowing" not in meta_str
        assert "Deep in the quiet canopy" not in meta_str

    manifest = compile_and_package_manifest(
        dream_id="test_unit_dream",
        director_script=mock_script,
        progress_callback=callback,
    )

    assert manifest["title"] == "The Glass Garden"
    assert manifest["styleId"] == "nocturne_toon"
    assert len(manifest["scenes"]) == 1

    scene0 = manifest["scenes"][0]
    assert scene0["world"]["kit"] == "forest"
    assert scene0["world"]["skyboxUrl"].startswith("/storage/skyboxes/")
    assert scene0["ambientUrl"].startswith("/storage/ambient/")
    assert len(scene0["speeches"]) == 2  # Traveler + Narrator
    assert len(progress_events) >= 4

