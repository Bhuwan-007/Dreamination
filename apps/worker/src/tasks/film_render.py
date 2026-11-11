"""
Film compiler: FilmPlan (dict) -> FilmManifest (dict) for the 2.5D living-ink player.

Stages (reported through `progress`): art (backdrops, depth layers, objects, cast
figures) -> voices (one real TTS line per spoken line / narration, timed from the audio)
-> ambient -> package. All assets are content-hashed and cached, so re-rendering a dream
only regenerates what changed.
"""

from __future__ import annotations

import json
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from .audio import generate_ambient_track
from .film_art import active_provider, backdrop_asset, depth_layers, figure_asset, object_asset
from .storage_paths import storage_dir
from .tts import speak_line

Progress = Callable[[str, float], None]

NARRATOR = {"tone": "mid", "rate": -1, "index": 7}
MIN_SCENE = 6.0
MAX_SCENE = 18.0
TAIL = 1.6
SPEECH_GAP = 0.35


def _seed(*parts: Any) -> int:
    import hashlib

    return int(hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:8], 16) % 2_147_483_647


def film_manifest_path(dream_id: str):
    return storage_dir("manifests") / dream_id / "film_manifest.json"


def compile_film_manifest(
    dream_id: str,
    plan: dict[str, Any],
    version_id: str | None = None,
    progress: Progress | None = None,
) -> dict[str, Any]:
    report = progress or (lambda stage, pct: None)
    palette: dict[str, str] = plan.get("palette") or {}
    cast: list[dict[str, Any]] = plan.get("cast") or []
    scenes: list[dict[str, Any]] = plan.get("scenes") or []
    providers: dict[str, int] = {}

    def count(provider: str) -> None:
        providers[provider] = providers.get(provider, 0) + 1

    # ---- 1. Art --------------------------------------------------------------------
    report("art", 0.05)
    with ThreadPoolExecutor(max_workers=4) as pool:
        fig_futs = {
            c["cast_id"]: pool.submit(figure_asset, c.get("figure") or {}, c.get("visibility", "full"), palette)
            for c in cast
        }
        bg_futs, layer_futs, obj_futs = [], [], []
        for i, s in enumerate(scenes):
            seed = _seed(dream_id, s.get("scene_id", i), s.get("backdrop_prompt", ""))
            bg_futs.append(pool.submit(backdrop_asset, s.get("backdrop_prompt", s.get("setting", "")),
                                       s.get("setting_kind", "void"), s.get("time_of_day", "night"),
                                       s.get("mood", "wonder"), palette, seed))
            layer_futs.append(pool.submit(depth_layers, s.get("setting_kind", "void"), palette, seed))
            obj_futs.append([pool.submit(object_asset, o["name"], palette, _seed(o["name"], dream_id))
                             for o in s.get("objects", [])])
        figures = {cid: f.result() for cid, f in fig_futs.items()}
        report("art", 0.35)
        backdrops = [f.result() for f in bg_futs]
        layers = [f.result() for f in layer_futs]
        objects = [[f.result() for f in fs] for fs in obj_futs]
    for b in backdrops:
        count(b["provider"])
    for row in objects:
        for o in row:
            if not o.get("skip"):
                count(o["provider"])
    report("art", 0.5)

    # ---- 2. Voices + timeline --------------------------------------------------------
    voice_of = {c["cast_id"]: (c.get("voice") or {}, idx) for idx, c in enumerate(cast)}
    compiled_scenes: list[dict[str, Any]] = []
    cursor = 0.0
    for i, s in enumerate(scenes):
        report("voices", 0.5 + 0.3 * i / max(1, len(scenes)))
        beats_in = sorted(s.get("beats", []), key=lambda b: b.get("t", 0.0))
        out_beats: list[dict[str, Any]] = []
        speeches: list[dict[str, Any]] = []
        speech_intervals: list[tuple[float, float]] = []
        offset = 0.0
        last_end = 0.0
        for b in beats_in:
            t_local = float(b.get("t", 0.0)) + offset
            entry = {"castId": b["cast_id"], "action": b["action"], "toX": b.get("to_x"), "emotion": b.get("emotion", "neutral")}
            if b["action"] == "speak" and b.get("line"):
                voice, idx = voice_of.get(b["cast_id"], ({}, 0))
                tts = speak_line(b["line"], voice.get("tone", "mid"), int(voice.get("rate", 0)), idx)
                t_local = max(t_local, last_end + SPEECH_GAP)
                estimated = max(1.4, len(b["line"].split()) * 0.36 + 0.4)
                offset = t_local - float(b.get("t", 0.0)) + (tts.duration - estimated)
                last_end = t_local + tts.duration
                speech_intervals.append((t_local, last_end))
                speeches.append({
                    "castId": b["cast_id"], "text": b["line"], "startTime": round(cursor + t_local, 3),
                    "duration": tts.duration, "audioUrl": tts.audio_url,
                    "wordTimings": [w.model_dump() for w in tts.word_timings],
                })
                entry["duration"] = tts.duration
            else:
                entry["duration"] = {"enter": 1.0, "exit": 1.2, "walk": 2.6, "gesture": 1.2, "turn": 0.6}.get(b["action"], 1.0)
            entry["t"] = round(cursor + t_local, 3)
            out_beats.append(entry)

        narration = s.get("narration")
        if narration:
            tts = speak_line(narration, NARRATOR["tone"], NARRATOR["rate"], NARRATOR["index"])
            start = max(0.9, last_end + SPEECH_GAP) if speeches else 0.9
            speeches.append({
                "castId": "narrator", "text": narration, "startTime": round(cursor + start, 3),
                "duration": tts.duration, "audioUrl": tts.audio_url,
                "wordTimings": [w.model_dump() for w in tts.word_timings],
            })
            speech_intervals.append((start, start + tts.duration))
            last_end = max(last_end, start + tts.duration)

        beat_end = max([b["t"] - cursor + b.get("duration", 0.0) for b in out_beats] + [0.0])
        duration = round(max(MIN_SCENE, min(MAX_SCENE, max(last_end, beat_end) + TAIL)), 3)

        ambient_url = generate_ambient_track(
            dream_id=f"{dream_id}_film_{i}",
            duration=duration,
            preset=s.get("ambient", "forest_whisper"),
            motif=None,
            speech_intervals=speech_intervals,
        )

        bg = backdrops[i]
        lay = layers[i]
        compiled_scenes.append({
            "index": i,
            "sceneId": s.get("scene_id", i + 1),
            "heading": s.get("heading", ""),
            "setting": s.get("setting", ""),
            "settingKind": s.get("setting_kind", "void"),
            "mood": s.get("mood", "wonder"),
            "timeOfDay": s.get("time_of_day", "night"),
            "source": s.get("source", "fallback"),
            "startTime": round(cursor, 3),
            "duration": duration,
            "endTime": round(cursor + duration, 3),
            "transitionIn": s.get("transition_in", "dissolve"),
            "camera": s.get("camera", "drift"),
            "layers": [
                {"depth": "sky", "url": bg["url"], "provider": bg["provider"]},
                {"depth": "mist", "url": lay["mist"]},
                {"depth": "near", "url": lay["foreground"]},
            ],
            "objects": [
                {**{k: o.get(k) for k in ("name", "depth", "x", "scale", "floating")},
                 "url": objects[i][j]["url"], "aspect": objects[i][j]["aspect"]}
                for j, o in enumerate(s.get("objects", []))
                if not objects[i][j].get("skip")  # nothing the painter could honestly draw
            ],
            "characters": [{"castId": c["cast_id"], "x": c.get("x", 0.0), "facing": c.get("facing", 1)}
                           for c in s.get("characters", [])],
            "beats": out_beats,
            "speeches": speeches,
            "narration": narration,
            "effects": [{"type": e["type"], "at": round(cursor + float(e.get("at", 0.5)), 3),
                         "duration": float(e.get("duration", 4.0))} for e in s.get("effects", [])],
            "ambient": s.get("ambient"),
            "ambientUrl": ambient_url,
        })
        cursor += duration

    # ---- 3. Package -----------------------------------------------------------------
    report("package", 0.92)
    sources = [sc["source"] for sc in compiled_scenes]
    manifest = {
        "version": 2,
        "renderId": uuid.uuid4().hex,
        "dreamId": dream_id,
        "versionId": version_id,
        "title": plan.get("title", "Untitled dream"),
        "styleId": plan.get("style_id", "ink_wash"),
        "palette": palette,
        "totalDuration": round(cursor, 3),
        "provenance": {
            "director": "llm" if sources and all(x == "llm" for x in sources)
            else ("mixed" if "llm" in sources else "fallback"),
            "imageProvider": active_provider(),
            "images": providers,
        },
        "cast": [
            {
                "castId": c["cast_id"], "name": c["name"], "description": c.get("description", ""),
                "visibility": c.get("visibility", "full"), "returning": bool(c.get("returning")),
                "color": (c.get("figure") or {}).get("color"), "kind": (c.get("figure") or {}).get("kind", "human"),
                "height": float((c.get("figure") or {}).get("height", 1.0)),
                "figureUrl": figures[c["cast_id"]]["url"], "aspect": figures[c["cast_id"]]["aspect"],
            }
            for c in cast
        ],
        "scenes": compiled_scenes,
    }
    path = film_manifest_path(dream_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    report("package", 1.0)
    return manifest
