"""
Film Director (2.5D living-ink films).

Builds a FilmPlan from a dream's own reconstructed story and its linked entities.

Design rules (these fix the "every dream looks the same" failure of the 3D path):
- Nothing is drawn from a fixed template. Settings, objects, characters, lines and effects
  all come from the words of *this* dream's scenes.
- Every person or creature in the dream becomes a cast member with its own figure spec,
  parsed from the user's description; recurring entities reuse their stored figure.
- An LLM may enrich each scene's art direction, but the deterministic builder already
  produces a dream-specific plan, so an unavailable or weak LLM never collapses the film
  into generic filler. Each scene records whether the LLM contributed (`source`).
- Image prompts never contain cast names; names are replaced by neutral descriptions.
"""

from __future__ import annotations

import asyncio
import hashlib
import re
from pathlib import Path
from typing import Any

from ..logging import logger
from ..providers.llm import complete_json
from ..schemas.film import (
    CastMember,
    FigureSpec,
    FilmBeat,
    FilmPlan,
    FilmScene,
    SceneEffect,
    SceneObject,
    StagedCharacter,
    VoiceSpec,
)

PROMPT_FILE = Path(__file__).resolve().parents[2] / "prompts" / "film_scene_v1.md"

MAX_CAST = 6
MAX_CAST_PER_SCENE = 4
MAX_OBJECTS_PER_SCENE = 4

DREAMER_ALIASES = {"me", "i", "myself", "you", "dreamer", "the dreamer", "narrator-self"}

# --------------------------------------------------------------------------------------
# Lexicons
# --------------------------------------------------------------------------------------

# word -> canonical drawable object
OBJECT_LEXICON: dict[str, str] = {
    "door": "door", "doorway": "door", "gate": "gate", "window": "window", "clock": "clock",
    "clocks": "clock", "watch": "clock", "tree": "tree", "trees": "tree", "oak": "tree",
    "stairs": "staircase", "staircase": "staircase", "steps": "staircase", "ladder": "ladder",
    "boat": "boat", "ship": "boat", "canoe": "boat", "lamp": "lamp", "lantern": "lamp",
    "streetlight": "lamp", "candle": "candle", "mirror": "mirror", "moon": "moon",
    "key": "key", "keys": "key", "house": "house", "home": "house", "cottage": "house",
    "chair": "chair", "bench": "bench", "bed": "bed", "book": "book", "books": "book",
    "letter": "letter", "bridge": "bridge", "car": "car", "bus": "bus", "train": "train",
    "umbrella": "umbrella", "bell": "bell", "flower": "flower", "flowers": "flower",
    "rose": "flower", "phone": "phone", "mask": "mask", "cup": "cup", "teacup": "cup",
    "table": "table", "piano": "piano", "well": "well", "tower": "tower", "lighthouse": "tower",
    "shell": "shell", "bottle": "bottle", "box": "box", "suitcase": "suitcase",
    "bicycle": "bicycle", "bike": "bicycle", "statue": "statue", "fountain": "fountain",
    "ring": "ring", "crown": "crown", "kite": "kite", "balloon": "balloon", "locker": "locker",
    "lockers": "locker", "desk": "desk", "swing": "swing", "tent": "tent", "temple": "temple",
    "church": "temple", "pillar": "pillar", "column": "pillar", "arch": "arch", "balcony": "balcony",
    "roof": "roof", "terrace": "balcony", "railing": "balcony", "star": "star", "stars": "star",
}

CREATURE_KINDS = {
    "dog": "dog", "puppy": "dog", "wolf": "wolf", "cat": "cat", "kitten": "cat", "bird": "bird",
    "crow": "bird", "owl": "bird", "raven": "bird", "fox": "fox", "deer": "deer", "horse": "horse",
    "fish": "fish", "whale": "fish", "snake": "snake", "rabbit": "rabbit", "tiger": "cat",
    "lion": "cat", "moth": "moth", "butterfly": "moth",
}

SETTING_KINDS: list[tuple[str, tuple[str, ...]]] = [
    ("water", ("sea", "ocean", "lake", "river", "shore", "beach", "water", "flood", "wave", "pier", "harbour", "harbor")),
    ("forest", ("forest", "woods", "grove", "jungle", "trees", "moss")),
    ("city", ("city", "street", "alley", "road", "traffic", "market", "station", "rooftop", "town")),
    ("corridor", ("corridor", "hallway", "hall", "school", "hospital", "office", "tunnel", "lockers")),
    ("interior", ("room", "house", "home", "kitchen", "bedroom", "attic", "library", "classroom", "apartment")),
    ("mountain", ("mountain", "cliff", "peak", "hill", "valley", "canyon")),
    ("desert", ("desert", "sand", "dune")),
    ("sky", ("sky", "clouds", "flying", "floating", "air", "space", "stars")),
    ("field", ("field", "meadow", "grass", "garden", "farm", "park")),
]

AMBIENT_FOR_SETTING = {  # presets implemented in apps/worker/src/tasks/audio.py
    "water": "underwater_hum", "forest": "forest_whisper", "city": "institutional_drone",
    "corridor": "institutional_drone", "interior": "void_resonance", "mountain": "wind_howl",
    "desert": "wind_howl", "sky": "wind_howl", "field": "forest_whisper", "void": "void_resonance",
}

COLOR_WORDS = {
    "red": "#B5534C", "crimson": "#9E3B3B", "blue": "#4C6FA5", "navy": "#2C3E62",
    "green": "#5E7D4E", "yellow": "#D9B54A", "gold": "#E2B866", "golden": "#E2B866",
    "white": "#E8E4D8", "black": "#1E2226", "grey": "#7F8A88", "gray": "#7F8A88",
    "silver": "#BDCEBC", "brown": "#7A5A3C", "purple": "#6E5486", "violet": "#7C62A0",
    "pink": "#C9747C", "orange": "#C9793C", "teal": "#559CA9",
}

# Distinct default accents so cast members never look alike when the user gave no colour.
DEFAULT_ACCENTS = ["#559CA9", "#C9747C", "#909653", "#E2B866", "#7C62A0", "#C9793C"]

FEMALE_HINTS = ("she", "her", "woman", "girl", "mother", "mom", "mum", "grandmother", "grandma",
                "sister", "aunt", "wife", "daughter", "queen", "lady", "nani", "dadi", "maa")
MALE_HINTS = ("he", "him", "his", "man", "boy", "father", "dad", "grandfather", "grandpa",
              "brother", "uncle", "husband", "son", "king", "papa", "nana", "dada")
CHILD_HINTS = ("child", "kid", "boy", "girl", "baby", "little", "younger", "toddler")
HIDDEN_HINTS = ("faceless", "no face", "couldn't see", "could not see", "never saw", "without a face",
                "hidden", "unknown", "stranger", "shadow", "silhouette", "blurred", "blurry")

MOOD_WORDS = {
    "fearful": ("afraid", "scared", "fear", "terror", "panic", "dread", "chased", "hunted", "dark"),
    "uneasy": ("uneasy", "strange", "wrong", "lost", "anxious", "nervous", "late", "trapped"),
    "melancholic": ("sad", "grief", "cry", "crying", "tears", "lonely", "miss", "gone", "funeral"),
    "peaceful": ("calm", "peace", "quiet", "gentle", "warm", "safe", "soft", "rest"),
    "wonder": ("wonder", "glow", "shimmer", "magic", "beautiful", "impossible", "stars", "light"),
}

MOTION_WORDS = ("walk", "walked", "walking", "ran", "run", "running", "followed", "follow", "moved",
                "crossed", "climbed", "wandered", "chased", "drifted", "went")
GESTURE_WORDS = ("point", "pointed", "reach", "reached", "wave", "waved", "touched", "held", "hugged", "offered")
EXIT_WORDS = ("left", "vanished", "disappeared", "faded", "dissolved", "walked away", "gone")

EFFECT_WORDS: list[tuple[str, tuple[str, ...]]] = [
    ("flood", ("flood", "rising water", "water rose", "drown", "submerged", "tide")),
    ("float", ("float", "floating", "levitat", "hovering", "weightless", "flying", "flew")),
    ("rain", ("rain", "storm", "drizzle")),
    ("snow", ("snow", "frost", "ice")),
    ("ash", ("ash", "smoke", "burning", "fire", "embers")),
    ("glow", ("glow", "glowing", "light", "shining", "lantern", "candle")),
    ("fireflies", ("firefl", "sparks", "stars fell", "glitter", "star trail", "shooting star")),
]

TIME_WORDS = {
    "dawn": ("dawn", "sunrise", "morning"),
    "dusk": ("dusk", "sunset", "evening", "twilight"),
    "day": ("noon", "daylight", "sunny", "afternoon", "bright day"),
}

STYLE_PALETTES = {
    "ink_wash": {"ink": "#14181C", "paper": "#E9E2D0", "accent": "#E2B866", "glow": "#F3D998", "mist": "#BDCEBC"},
}


# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------


def _slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return s or "figure"


def _stable_int(text: str) -> int:
    return int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:8], 16)


def _has_word(text: str, word: str) -> bool:
    return re.search(rf"\b{re.escape(word)}\b", text) is not None


def _contains_any(text: str, words: tuple[str, ...]) -> bool:
    return any((_has_word(text, w) if " " not in w and w.isalpha() else w in text) for w in words)


def _scene_text(scene: dict[str, Any]) -> str:
    parts = [str(scene.get("heading", ""))]
    for b in scene.get("beats", []) or []:
        if isinstance(b, dict):
            parts.append(str(b.get("text", "")))
    for d in scene.get("dialogue", []) or []:
        if isinstance(d, dict):
            parts.append(str(d.get("line", "")))
    return " ".join(p for p in parts if p)


def _first_sentence(text: str, max_words: int = 24) -> str:
    sentence = re.split(r"(?<=[.!?])\s+", text.strip())[0] if text.strip() else ""
    words = sentence.split()
    if len(words) > max_words:
        sentence = " ".join(words[:max_words]).rstrip(",;:") + "…"
    return sentence


def detect_setting_kind(text: str) -> str:
    lower = text.lower()
    best, best_hits = "void", 0
    for kind, words in SETTING_KINDS:
        hits = sum(1 for w in words if _has_word(lower, w))
        if hits > best_hits:
            best, best_hits = kind, hits
    return best


def detect_mood(text: str, fallback: str = "wonder") -> str:
    lower = text.lower()
    scores = {m: sum(1 for w in ws if _has_word(lower, w)) for m, ws in MOOD_WORDS.items()}
    mood, score = max(scores.items(), key=lambda kv: kv[1])
    return mood if score > 0 else fallback


def detect_time_of_day(text: str) -> str:
    lower = text.lower()
    for tod, words in TIME_WORDS.items():
        if any(_has_word(lower, w) for w in words):
            return tod
    return "night"


def detect_objects(text: str, extra_names: list[str] | None = None) -> list[str]:
    """Objects actually mentioned in this scene, in order of first mention."""
    lower = text.lower()
    found: list[tuple[int, str]] = []
    seen: set[str] = set()
    for word, canonical in OBJECT_LEXICON.items():
        m = re.search(rf"\b{re.escape(word)}\b", lower)
        if m and canonical not in seen:
            seen.add(canonical)
            found.append((m.start(), canonical))
    for name in extra_names or []:
        n = name.lower().strip()
        if not n or n in seen:
            continue
        idx = lower.find(n)
        if idx >= 0:
            seen.add(n)
            found.append((idx, n))
    found.sort()
    return [name for _, name in found[:MAX_OBJECTS_PER_SCENE]]


def detect_effects(text: str) -> list[str]:
    lower = text.lower()
    out = []
    for effect, words in EFFECT_WORDS:
        if any(w in lower for w in words):
            out.append(effect)
    return out[:2]


def parse_figure(name: str, description: str, entity_type: str, index: int) -> tuple[FigureSpec, VoiceSpec, str]:
    """Turns the user's own words about a character into a figure, a voice and a visibility."""
    text = f"{name} {description}".lower()
    kind = "human"
    if entity_type == "creature" or any(_has_word(text, w) for w in CREATURE_KINDS):
        for word, k in CREATURE_KINDS.items():
            if _has_word(text, word):
                kind = k
                break
        else:
            kind = "creature"

    height = 1.0
    if any(_has_word(text, w) for w in ("tall", "towering", "giant", "huge", "enormous")):
        height = 1.25
    if any(_has_word(text, w) for w in ("short", "small", "tiny")):
        height = 0.85
    if any(_has_word(text, w) for w in CHILD_HINTS):
        height = 0.72

    build = "average"
    if any(_has_word(text, w) for w in ("thin", "slim", "slender", "frail", "skinny")):
        build = "slight"
    if any(_has_word(text, w) for w in ("broad", "big", "heavy", "strong", "large", "stocky")):
        build = "broad"

    hair = "short"
    if any(_has_word(text, w) for w in ("hood", "hooded", "cloak")):
        hair = "hood"
    elif any(_has_word(text, w) for w in ("bald",)):
        hair = "bald"
    elif any(_has_word(text, w) for w in ("curly", "curls")):
        hair = "curly"
    elif "long hair" in text or any(_has_word(text, w) for w in ("braid", "braids", "ponytail")):
        hair = "long"

    garment = "plain"
    for word, g in (("coat", "coat"), ("jacket", "coat"), ("overcoat", "coat"), ("dress", "dress"),
                    ("saree", "dress"), ("sari", "dress"), ("gown", "dress"), ("robe", "robe"),
                    ("cloak", "robe"), ("suit", "suit"), ("uniform", "uniform"), ("kurta", "robe")):
        if _has_word(text, word):
            garment = g
            break

    color = DEFAULT_ACCENTS[index % len(DEFAULT_ACCENTS)]
    for word, hex_color in COLOR_WORDS.items():
        if _has_word(text, word):
            color = hex_color
            break

    accessory = "none"
    for word, acc in (("hat", "hat"), ("cap", "hat"), ("umbrella", "umbrella"), ("cane", "cane"),
                      ("stick", "cane"), ("bag", "bag"), ("glasses", "glasses"), ("spectacles", "glasses"),
                      ("lantern", "lantern")):
        if _has_word(text, word):
            accessory = acc
            break

    visibility = "full"
    if any(h in text for h in HIDDEN_HINTS):
        visibility = "hidden" if any(h in text for h in ("faceless", "no face", "without a face")) else "shadowed"

    register = "mid"
    if any(_has_word(text, w) for w in FEMALE_HINTS) or any(_has_word(text, w) for w in CHILD_HINTS):
        register = "high"
    elif any(_has_word(text, w) for w in MALE_HINTS):
        register = "low"
    elif kind != "human":
        register = "low" if kind in ("wolf", "horse", "deer") else "high"
    rate = -1 if any(_has_word(text, w) for w in ("old", "elderly", "grandfather", "grandmother", "slow")) else 0

    figure = FigureSpec(kind=kind, height=height, build=build, hair=hair, garment=garment,
                        color=color, accessory=accessory)
    return figure, VoiceSpec(tone=register, rate=rate), visibility


def _name_matchers(name: str) -> list[str]:
    lower = name.lower().strip()
    out = [lower]
    # "Vaibhav's father" should also match "father" / "his father" in scene text.
    if "'s " in lower:
        out.append(lower.split("'s ", 1)[1])
    words = [w for w in re.split(r"\W+", lower) if len(w) >= 4]
    out.extend(words[-1:])
    return [m for m in dict.fromkeys(out) if m]


def _neutral_label(member: CastMember) -> str:
    f = member.figure
    if f.kind != "human":
        return f"a {f.kind}"
    size = "tall " if f.height > 1.1 else ("small " if f.height < 0.8 else "")
    garment = {"plain": "", "coat": " in a long coat", "dress": " in a flowing dress", "robe": " in a robe",
               "suit": " in a suit", "uniform": " in a uniform"}[f.garment]
    return f"a {size}figure{garment}".replace("  ", " ")


def scrub_names(text: str, cast: list[CastMember]) -> str:
    """Replace every cast name in an outbound prompt with a neutral description."""
    out = text
    for member in sorted(cast, key=lambda m: -len(m.name)):
        if member.cast_id == "dreamer":
            continue
        for matcher in _name_matchers(member.name)[:1]:
            out = re.sub(re.escape(matcher), _neutral_label(member), out, flags=re.IGNORECASE)
    return out


# --------------------------------------------------------------------------------------
# Deterministic builder
# --------------------------------------------------------------------------------------


def build_cast(
    story: dict[str, Any],
    entities: list[dict[str, Any]],
    known_figures: dict[str, dict[str, Any]] | None = None,
) -> list[CastMember]:
    """Dreamer + every person/creature entity + every speaker named in the dialogue."""
    known_figures = known_figures or {}
    cast: list[CastMember] = [
        CastMember(
            cast_id="dreamer",
            name="You",
            description="the dreamer",
            visibility="shadowed",
            figure=FigureSpec(kind="human", color="#E2B866", garment="coat"),
            voice=VoiceSpec(tone="mid"),
        )
    ]
    by_key: dict[str, CastMember] = {}

    def add(name: str, description: str, entity_type: str, entity_id: str | None) -> None:
        key = name.lower().strip()
        if not key or key in DREAMER_ALIASES or key in by_key or len(cast) >= MAX_CAST:
            return
        index = len(cast)
        stored = known_figures.get(entity_id or "") if entity_id else None
        if stored:
            figure = FigureSpec.model_validate(stored.get("figure", {}))
            voice = VoiceSpec.model_validate(stored.get("voice", {}))
            visibility = stored.get("visibility", "full")
        else:
            figure, voice, visibility = parse_figure(name, description, entity_type, index)
        cast_id = _slug(name)
        while any(c.cast_id == cast_id for c in cast):
            cast_id += "_x"
        member = CastMember(
            cast_id=cast_id,
            name=name,
            entity_id=entity_id,
            description=description,
            visibility=visibility,  # type: ignore[arg-type]
            figure=figure,
            voice=voice,
            returning=bool(stored),
        )
        cast.append(member)
        by_key[key] = member

    for ent in sorted(entities, key=lambda e: -float(e.get("salience", 0.5) or 0.5)):
        if ent.get("type") in ("person", "creature"):
            add(str(ent.get("name", "")), str(ent.get("description") or ""), str(ent.get("type")), ent.get("entity_id"))

    for scene in story.get("scenes", []) or []:
        for d in scene.get("dialogue", []) or []:
            speaker = str(d.get("speaker", "")).strip()
            if speaker:
                match = next((e for e in entities if str(e.get("name", "")).lower() == speaker.lower()), None)
                add(speaker, str((match or {}).get("description") or ""), "person", (match or {}).get("entity_id"))
    return cast


def _resolve_speaker(speaker: str, cast: list[CastMember]) -> str:
    key = speaker.lower().strip()
    if key in DREAMER_ALIASES:
        return "dreamer"
    for member in cast:
        if member.name.lower() == key:
            return member.cast_id
    for member in cast:
        if any(m in key or key in m for m in _name_matchers(member.name)):
            return member.cast_id
    return "dreamer"


def _cast_in_scene(scene: dict[str, Any], cast: list[CastMember]) -> list[str]:
    text = _scene_text(scene).lower()
    present = ["dreamer"]
    for d in scene.get("dialogue", []) or []:
        cid = _resolve_speaker(str(d.get("speaker", "")), cast)
        if cid not in present:
            present.append(cid)
    for member in cast:
        if member.cast_id in present or member.cast_id == "dreamer":
            continue
        if any(_has_word(text, m) if " " not in m else m in text for m in _name_matchers(member.name)):
            present.append(member.cast_id)
    return present[:MAX_CAST_PER_SCENE]


def _stage_positions(cast_ids: list[str]) -> list[StagedCharacter]:
    n = len(cast_ids)
    if n == 1:
        return [StagedCharacter(cast_id=cast_ids[0], x=-0.15, facing=1)]
    span = 0.55 if n == 2 else 0.7
    staged = []
    for i, cid in enumerate(cast_ids):
        x = -span + (2 * span) * (i / (n - 1))
        staged.append(StagedCharacter(cast_id=cid, x=round(x, 3), facing=1 if x < 0 else -1))
    return staged


def _estimate_speech(line: str) -> float:
    return max(1.4, len(line.split()) * 0.36 + 0.4)


def build_scene(
    index: int,
    scene: dict[str, Any],
    cast: list[CastMember],
    prev_camera: str | None,
    dream_mood: str,
) -> FilmScene:
    text = _scene_text(scene)
    lower = text.lower()
    beats_text = [str(b.get("text", "")) for b in scene.get("beats", []) or [] if isinstance(b, dict)]
    heading = str(scene.get("heading") or f"Scene {index}")
    setting_kind = detect_setting_kind(text)
    mood = detect_mood(text, fallback=dream_mood)
    tod = detect_time_of_day(text)

    lead = _first_sentence(beats_text[0]) if beats_text else heading
    setting = f"{heading}: {lead}" if lead and lead.lower() != heading.lower() else heading

    object_names = detect_objects(text)
    objects: list[SceneObject] = []
    for i, name in enumerate(object_names):
        depth = "far" if name in ("moon", "tower", "house", "temple", "bridge", "train") else ("near" if i == 2 else "mid")
        side = -1 if i % 2 == 0 else 1
        x = side * (0.35 + 0.18 * (i // 2))
        floating = "float" in lower or name in ("moon", "balloon", "kite")
        objects.append(SceneObject(name=name, depth=depth, x=max(-0.95, min(0.95, x)), floating=floating))

    present = _cast_in_scene(scene, cast)
    staged = _stage_positions(present)

    beats: list[FilmBeat] = []
    for i, cid in enumerate(present):
        beats.append(FilmBeat(t=round(0.2 + 0.45 * i, 2), cast_id=cid, action="enter"))
    if _contains_any(lower, MOTION_WORDS):
        beats.append(FilmBeat(t=0.9, cast_id="dreamer", action="walk", to_x=0.15))

    cursor = 1.4
    dialogue = [d for d in scene.get("dialogue", []) or [] if isinstance(d, dict) and d.get("line")]
    narration: str | None = None
    if dialogue:
        for d in dialogue[:4]:
            cid = _resolve_speaker(str(d.get("speaker", "")), cast)
            if cid not in present:
                present.append(cid)
                staged = _stage_positions(present)
                beats.append(FilmBeat(t=max(0.0, cursor - 0.6), cast_id=cid, action="enter"))
            line = str(d["line"]).strip()
            beats.append(FilmBeat(t=round(cursor, 2), cast_id=cid, action="speak", line=line,
                                  emotion=str(d.get("emotion") or mood)))
            cursor += _estimate_speech(line) + 0.5
    else:
        narration = _first_sentence(" ".join(beats_text[:2]), max_words=26) or None

    if _contains_any(lower, GESTURE_WORDS) and len(present) > 0:
        beats.append(FilmBeat(t=round(cursor * 0.6, 2), cast_id=present[-1], action="gesture"))
    if _contains_any(lower, EXIT_WORDS) and len(present) > 1:
        beats.append(FilmBeat(t=round(cursor + 0.4, 2), cast_id=present[-1], action="exit"))
    beats.sort(key=lambda b: b.t)

    effects = [SceneEffect(type=e, at=0.8 + i, duration=5.0) for i, e in enumerate(detect_effects(text))]  # type: ignore[arg-type]

    camera_cycle = ["push_in", "pan_right", "drift", "pull_out", "pan_left"]
    camera = "push_in" if mood == "fearful" else camera_cycle[(index - 1) % len(camera_cycle)]
    if camera == prev_camera:
        camera = camera_cycle[index % len(camera_cycle)]

    transition = "dissolve"
    if any(e.type == "flood" for e in effects) or setting_kind == "water":
        transition = "submerge"
    elif index > 1 and _contains_any(lower, ("suddenly", "then", "instead", "shifted", "changed")):
        transition = "cut"
    elif index == 1:
        transition = "fade_black"

    backdrop_prompt = scrub_names(
        f"wide establishing view of {setting.split(':', 1)[-1].strip() or heading}, {heading.lower()}, "
        f"{setting_kind if setting_kind != 'void' else 'dreamlike empty expanse'}, {tod} light, {mood} atmosphere, "
        "no people",
        cast,
    )

    return FilmScene(
        scene_id=int(scene.get("scene_id") or index),
        heading=heading,
        setting=setting,
        mood=mood,
        setting_kind=setting_kind,
        time_of_day=tod,  # type: ignore[arg-type]
        backdrop_prompt=backdrop_prompt,
        objects=objects,
        characters=staged,
        beats=beats,
        narration=narration,
        camera=camera,  # type: ignore[arg-type]
        effects=effects,
        transition_in=transition,  # type: ignore[arg-type]
        ambient=AMBIENT_FOR_SETTING.get(setting_kind, "void_drone"),
        source="fallback",
    )


def build_film_plan(
    story: dict[str, Any],
    entities: list[dict[str, Any]] | None = None,
    known_figures: dict[str, dict[str, Any]] | None = None,
    style_id: str = "ink_wash",
    dream_mood: str | None = None,
) -> FilmPlan:
    entities = entities or []
    cast = build_cast(story, entities, known_figures)
    raw_scenes = [s for s in story.get("scenes", []) or [] if isinstance(s, dict)][:8]
    if not raw_scenes:
        raw_scenes = [{"scene_id": 1, "heading": story.get("title", "A dream"), "beats": [], "dialogue": []}]

    overall_mood = dream_mood or detect_mood(" ".join(_scene_text(s) for s in raw_scenes))
    scenes: list[FilmScene] = []
    prev_camera: str | None = None
    for i, raw in enumerate(raw_scenes, start=1):
        scene = build_scene(i, raw, cast, prev_camera, overall_mood)
        prev_camera = scene.camera
        scenes.append(scene)

    # Only keep cast members who actually appear somewhere.
    used = {c.cast_id for s in scenes for c in s.characters}
    cast = [c for c in cast if c.cast_id in used]

    palette = dict(STYLE_PALETTES.get(style_id, STYLE_PALETTES["ink_wash"]))
    if overall_mood in ("fearful", "uneasy"):
        palette["accent"] = "#C9747C"
    elif overall_mood == "peaceful":
        palette["accent"] = "#909653"

    return FilmPlan(title=str(story.get("title") or "Untitled dream"), style_id=style_id, palette=palette,
                    cast=cast, scenes=scenes)


# --------------------------------------------------------------------------------------
# Optional LLM enrichment (per scene)
# --------------------------------------------------------------------------------------

_ALLOWED_CAMERA = {"push_in", "pull_out", "pan_left", "pan_right", "drift", "still"}
_ALLOWED_EFFECTS = {"flood", "float", "rain", "snow", "ash", "glow", "fireflies"}
_ALLOWED_TOD = {"night", "dusk", "dawn", "day", "timeless"}
_ALLOWED_DEPTH = {"far", "mid", "near"}


def _load_prompt() -> str:
    try:
        return PROMPT_FILE.read_text(encoding="utf-8")
    except OSError:
        return "Return JSON art direction for this dream scene.\n{scene_text}"


def apply_enrichment(scene: FilmScene, data: dict[str, Any], cast: list[CastMember]) -> FilmScene:
    """Merge validated LLM art direction onto a deterministic scene. Invalid fields are ignored."""
    updated = scene.model_copy(deep=True)
    changed = False
    setting = data.get("setting")
    if isinstance(setting, str) and 8 <= len(setting) <= 240:
        updated.setting = setting.strip()
        changed = True
    prompt = data.get("backdrop_prompt")
    if isinstance(prompt, str) and 12 <= len(prompt) <= 400:
        updated.backdrop_prompt = scrub_names(prompt.strip(), cast) + ", no people"
        changed = True
    tod = data.get("time_of_day")
    if tod in _ALLOWED_TOD:
        updated.time_of_day = tod
    cam = data.get("camera")
    if cam in _ALLOWED_CAMERA:
        updated.camera = cam
    objs = data.get("objects")
    if isinstance(objs, list) and objs:
        new_objs: list[SceneObject] = []
        for i, o in enumerate(objs[:MAX_OBJECTS_PER_SCENE]):
            if isinstance(o, str):
                o = {"name": o}
            if not isinstance(o, dict) or not isinstance(o.get("name"), str):
                continue
            name = scrub_names(o["name"].strip().lower()[:40], cast)
            if not name:
                continue
            depth = o.get("depth") if o.get("depth") in _ALLOWED_DEPTH else ("mid" if i % 2 == 0 else "far")
            side = -1 if i % 2 == 0 else 1
            new_objs.append(SceneObject(name=name, depth=depth, x=side * (0.35 + 0.18 * (i // 2)),
                                        floating=bool(o.get("floating", False))))
        if new_objs:
            updated.objects = new_objs
            changed = True
    effs = data.get("effects")
    if isinstance(effs, list):
        valid = [e for e in effs if e in _ALLOWED_EFFECTS][:2]
        if valid:
            updated.effects = [SceneEffect(type=e, at=0.8 + i, duration=5.0) for i, e in enumerate(valid)]
    if changed:
        updated.source = "llm"
    return updated


async def enrich_film_plan(plan: FilmPlan, story: dict[str, Any], timeout_s: float = 90.0) -> FilmPlan:
    """Ask the LLM for richer art direction per scene. Never fails: falls back per scene."""
    template = _load_prompt()
    raw_scenes = [s for s in story.get("scenes", []) or [] if isinstance(s, dict)]

    async def one(i: int, scene: FilmScene) -> FilmScene:
        raw = raw_scenes[i] if i < len(raw_scenes) else {}
        prompt = template.replace("{scene_text}", _scene_text(raw) or scene.setting).replace(
            "{dream_title}", plan.title
        )
        try:
            data = await complete_json(prompt)
        except Exception as exc:  # noqa: BLE001 - any provider failure means "keep deterministic"
            logger.info(f"Film scene {scene.scene_id} enrichment unavailable ({type(exc).__name__}).")
            return scene
        return apply_enrichment(scene, data if isinstance(data, dict) else {}, plan.cast)

    try:
        scenes = await asyncio.wait_for(
            asyncio.gather(*(one(i, s) for i, s in enumerate(plan.scenes))), timeout=timeout_s
        )
    except TimeoutError:
        logger.warning("Film enrichment timed out; using deterministic art direction.")
        return plan
    return plan.model_copy(update={"scenes": list(scenes)})


def figure_record(member: CastMember) -> dict[str, Any]:
    """Serialisable figure spec stored on CharacterSheet so recurring characters stay the same."""
    return {
        "figure": member.figure.model_dump(),
        "voice": member.voice.model_dump(),
        "visibility": member.visibility,
    }


def stable_seed(*parts: str) -> int:
    return _stable_int("|".join(parts)) % 2_147_483_647
