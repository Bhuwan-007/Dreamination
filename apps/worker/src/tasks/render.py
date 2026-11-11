"""
Dream Render Pipeline Task and Manifest Packager.
Conforms to Architecture.md §6.6, §9 and Prompts.md P7/P8.
Orchestrates the 5 render stages:
1. director (15%)
2. textures_skybox (40%)
3. tts (65%)
4. ambient (85%)
5. package (100%)
Produces a fully resolved, audio-first scene_manifest.json for the 3D Dream Player.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

from celery import shared_task
from celery.utils.log import get_task_logger

from .audio import generate_ambient_track
from .textures import generate_skybox_texture
from .tts import generate_tts

logger = get_task_logger(__name__)

from .storage_paths import storage_dir

MANIFEST_STORAGE_DIR = storage_dir("manifests")


def report_render_progress(
    callback: Callable[[str, int, dict[str, Any] | None], None] | None,
    stage: str,
    percent: int,
    meta: dict[str, Any] | None = None,
) -> None:
    """Enforces Rule 6: never leak raw dream text in progress metadata."""
    if callback:
        callback(stage, percent, meta or {})
    logger.info(f"Dream Render Pipeline [{stage}]: {percent}%")


def compile_and_package_manifest(
    dream_id: str,
    director_script: dict[str, Any],
    progress_callback: Callable[[str, int, dict[str, Any] | None], None] | None = None,
) -> dict[str, Any]:
    """
    Executes stages 2 through 5 synchronously/in-worker given a valid DirectorScript.
    Returns the complete SceneManifest dictionary.
    """
    scenes_data = director_script.get("scenes", [])
    title = director_script.get("title", "The Dream Machine")
    style_id = director_script.get("style_id", "nocturne_toon")

    report_render_progress(progress_callback, "textures_skybox", 35)

    # 1. Stage 2: Generate Skyboxes
    for s_idx, scene in enumerate(scenes_data):
        world = scene.get("world", {})
        sky_name = world.get("sky", "night_halo")
        skybox_url = generate_skybox_texture(sky_name=sky_name, dream_id=dream_id)
        world["skybox_url"] = skybox_url
        scene["world"] = world

    report_render_progress(progress_callback, "tts", 55)

    # 2. Stage 3: Generate Speech Audio and Word Timings
    cursor_time = 0.0
    compiled_scenes: list[dict[str, Any]] = []

    for s_idx, scene in enumerate(scenes_data):
        speeches: list[dict[str, Any]] = []
        timed_beats: list[dict[str, Any]] = []
        speech_intervals: list[tuple[float, float]] = []
        max_speech_end = 0.0

        beats = scene.get("beats", [])
        for beat in beats:
            b_action = beat.get("action")
            b_actor = beat.get("actor", "Traveler")
            b_args = beat.get("args") or {}
            b_time = float(beat.get("t", 0.0))
            duration = 2.0

            if b_action == "speak":
                line_text = str(b_args.get("line", ""))
                tts_out = generate_tts(line_text, voice=b_actor.lower(), emotion=scene.get("ambient", "neutral"))
                duration = tts_out.duration
                speech_start = cursor_time + b_time
                speech_end = speech_start + duration
                speech_intervals.append((b_time, b_time + duration))
                max_speech_end = max(max_speech_end, b_time + duration)

                speeches.append({
                    "actor": b_actor,
                    "text": line_text,
                    "startTime": speech_start,
                    "duration": duration,
                    "audioUrl": tts_out.audio_url,
                    "wordTimings": [w.model_dump() for w in tts_out.word_timings],
                })
            elif b_action in ("walk_to", "run_to"):
                speed = b_args.get("speed", "normal")
                duration = 4.0 if speed == "slow" else (2.0 if speed == "fast" else 3.0)
            elif b_action == "shot":
                duration = float(b_args.get("duration", 4.0))

            timed_beats.append({
                **beat,
                "absoluteTime": cursor_time + b_time,
                "duration": duration,
            })

        # Process Narration if present
        narration_text = scene.get("narration")
        if narration_text:
            tts_out = generate_tts(narration_text, voice="narrator", emotion="melancholic")
            narr_start = cursor_time + 0.5
            speeches.append({
                "actor": "narrator",
                "text": narration_text,
                "startTime": narr_start,
                "duration": tts_out.duration,
                "audioUrl": tts_out.audio_url,
                "wordTimings": [w.model_dump() for w in tts_out.word_timings],
            })
            speech_intervals.append((0.5, 0.5 + tts_out.duration))
            max_speech_end = max(max_speech_end, 0.5 + tts_out.duration)

        # Scene duration: clamped between 3.5s and 12.0s
        scene_duration = max(3.5, min(12.0, max_speech_end + 1.2))
        scene_start = cursor_time
        scene_end = scene_start + scene_duration

        # 3. Stage 4: Ambient Soundbed with Speech Ducking
        ambient_preset = scene.get("ambient", "forest_whisper")
        sound_motif = scene.get("sound_motif")
        ambient_url = generate_ambient_track(
            dream_id=f"{dream_id}_scene_{s_idx}",
            duration=scene_duration,
            preset=ambient_preset,
            motif=sound_motif,
            speech_intervals=speech_intervals,
        )

        world_info = scene.get("world", {})
        compiled_scenes.append({
            "sceneId": scene.get("scene_id", s_idx + 1),
            "index": s_idx,
            "startTime": round(scene_start, 3),
            "duration": round(scene_duration, 3),
            "endTime": round(scene_end, 3),
            "transitionIn": scene.get("transition_in", "dissolve" if s_idx == 0 else "cut"),
            "world": {
                "kit": world_info.get("kit", "void"),
                "sky": world_info.get("sky", "night_halo"),
                "skyboxUrl": world_info.get("skybox_url"),
                "light": world_info.get("light", "moonlit"),
                "fog": {
                    "density": world_info.get("fog", {}).get("density", 0.035),
                    "color": world_info.get("fog", {}).get("color", "#0c1c17"),
                },
                "weather": world_info.get("weather", "none"),
                "props": world_info.get("props", []),
                "effects": world_info.get("effects", []),
            },
            "cast": scene.get("cast", []),
            "beats": timed_beats,
            "speeches": speeches,
            "narration": narration_text,
            "ambient": ambient_preset,
            "ambientUrl": ambient_url,
            "soundMotif": sound_motif,
        })

        cursor_time = scene_end

    report_render_progress(progress_callback, "package", 90)

    # 4. Stage 5: Package Final SceneManifest
    manifest: dict[str, Any] = {
        "title": title,
        "styleId": style_id,
        "totalDuration": round(cursor_time, 3),
        "scenes": compiled_scenes,
    }

    dream_manifest_dir = MANIFEST_STORAGE_DIR / dream_id
    dream_manifest_dir.mkdir(parents=True, exist_ok=True)
    manifest_file = dream_manifest_dir / "scene_manifest.json"

    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    report_render_progress(progress_callback, "package", 100, {"manifest_url": f"/storage/manifests/{dream_id}/scene_manifest.json"})
    return manifest


@shared_task(bind=True, name="tasks.render_dream")
def render_dream_task(self, dream_id: str, director_script: dict[str, Any]) -> dict[str, Any]:
    """
    Celery task wrapper for the 5-stage render pipeline.
    """
    logger.info(f"Starting async render job for dream_id={dream_id}")

    def progress_reporter(stage: str, percent: int, meta: dict[str, Any] | None = None):
        self.update_state(
            state="PROGRESS",
            meta={
                "stage": stage,
                "percent": percent,
                "metadata": meta or {},
            },
        )

    manifest = compile_and_package_manifest(
        dream_id=dream_id,
        director_script=director_script,
        progress_callback=progress_reporter,
    )

    manifest_url = f"/storage/manifests/{dream_id}/scene_manifest.json"
    logger.info(f"Render job completed for dream_id={dream_id}: manifest at {manifest_url}")

    return {
        "status": "completed",
        "dream_id": dream_id,
        "manifest_url": manifest_url,
        "total_duration": manifest.get("totalDuration", 0.0),
    }

