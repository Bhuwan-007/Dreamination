# architecture.md: The Dream Machine

> How the system is built. Read `rules.md` and `prd.md` first. Schemas live in code (`/packages/shared`); this file explains structure and decisions.

## 1. System overview

```
 Browser (Next.js)                           Local machine / server
┌─────────────────────────────────┐     ┌──────────────────────────────────────┐
│ Capture · Review · Reflect      │HTTP │ FastAPI (apps/api)                   │
│ Journal · Cast · Lexicon        │◄───►│  auth · dreams · pipeline stages     │
│                                 │ SSE │  LLM director · repository layer     │
│ ┌─────────────────────────────┐ │     └───────┬──────────────────┬───────────┘
│ │ Dream Player (Three.js)     │ │             │ enqueue          │ SQL
│ │ procedural world · rigged   │ │     ┌───────▼───────┐   ┌──────▼────────────┐
│ │ cel-shaded cast · visemes   │ │     │ Redis queue   │   │ Postgres+pgvector │
│ │ camera shots · audio        │ │     └───────┬───────┘   └───────────────────┘
│ │ WebCodecs video export      │ │     ┌───────▼───────────────────────────────┐
│ └──────────────▲──────────────┘ │     │ Worker (apps/worker)                  │
│                │ manifest+assets│     │  TTS · skybox/texture gen · ambient   │
└────────────────┼────────────────┘     └───────┬───────────────────────────────┘
                 │                      ┌───────▼───────┐
                 └──────────────────────│ Object storage│ (MinIO locally)
                                        └───────────────┘
```

## 2. Monorepo layout

```
/apps/web               Next.js (App Router), TypeScript, Tailwind, Framer Motion
/packages/dream-player  Three.js player: world composer, cast, lip-sync, camera, look, export
/apps/api               FastAPI, services, repositories, prompts/, evals/
/apps/worker            Celery (or arq) tasks: TTS, skybox/texture generation, ambient audio
/packages/shared        Pydantic models + generated TS types (director script, dream, entities)
/config                 render.yaml (shots, look), styles/*.yaml (toon presets, palettes), world_kits/*.yaml
/scripts                fetch-avatars.sh, fetch-animations.sh (restricted assets: fetched, never committed)
/docs                   ARCHITECTURE, DECISIONS (ADR), PRIVACY, SAFETY, LEXICON, THIRD-PARTY-NOTICES
/infra                  docker-compose, MinIO, Postgres init
```

## 3. Stack (free-first)

| Layer | Default (free) | Fallback / upgrade |
|---|---|---|
| Frontend | Next.js + TS + Tailwind + Framer Motion | n/a |
| Player | Three.js (TypeScript) in `packages/dream-player`; Web Audio | react-three-fiber wrapper if useful |
| Avatars and lip-sync | TalkingHead (MIT) with a compatible rigged avatar (verify source availability) | VRoid/Blender avatars; primitive puppet |
| Animation clips | Ready Player Me animation library / Mixamo-retargeted clips, fetched by script | procedural walk bob and idle sway |
| World assets | Procedural terrain, sky, fog + CC0 packs (e.g. Kenney, Quaternius; verify each license) | primitive shapes |
| Look | Toon material with gradient ramp + outline (inverted hull or post pass), palette LUT, grain/bloom | simpler flat shading |
| API | FastAPI (Python) | n/a |
| DB | PostgreSQL + pgvector (Docker) | Neon / Supabase free tier later |
| Queue | Redis + Celery (or arq) in Docker | Postgres-based queue (simpler) |
| Storage | MinIO in Docker | Cloudflare R2 free tier later |
| LLM | Gemini API free tier | Ollama with a small local model |
| Embeddings | Local sentence-transformers (bge-small / MiniLM) | n/a |
| Speech-to-text | faster-whisper (small, local) | Whisper tiny/base for speed |
| Image generation (skyboxes, textures, backdrops only) | See ladder in section 5 | n/a |
| TTS | Kokoro (ONNX/WASM, local) | Piper; Web Speech for live preview only |
| Video export | WebCodecs + an MIT-licensed browser MP4 muxer (verify) | FFmpeg (local) |
| Auth | Local login (Auth.js credentials) | Supabase Auth later |

Constraint: 16 GB RAM and a ~4 GB VRAM GPU. See section 8.

## 4. Pipeline stages

Each stage is a typed function with its own tests. The user can approve between stages.

| # | Stage | Input | Output | Sync | Failure handling |
|---|---|---|---|---|---|
| 1 | Capture | audio/text, mood, context | `Dream` (status captured) | sync | draft autosave |
| 2 | Transcribe | audio | raw + cleaned transcript | async | retry; fall back to text |
| 3 | Follow-ups | notes | 0-3 questions | sync | skip on failure |
| 4 | Extract | notes + answers | fragments, entities, emotions, transitions | sync | retry; schema validation |
| 5 | Resolve entities | extracted entities + history | linked/new entities | sync | ask-the-user fallback |
| 6 | Retrieve | dream + graph | similar dreams, entity history, learned meanings | sync | empty context ok |
| 7 | Reconstruct | extraction + history | scenes with `source` + `inference_reason` | sync | retry; validator |
| 8 | Scene repair | scene + correction | regenerated scene | sync | n/a |
| 9 | Interpret | approved story + context | 2-3 threads, quotes validated | sync | drop invalid threads |
| 10 | Feedback | thread + feedback | updated `symbol_meanings` | sync | n/a |
| 11 | Director script | approved story + cast + style | Director script JSON, validated against the action vocabulary | sync | retry; validator |
| 12 | Assets | director script + style | skybox/textures, TTS audio + word timings, ambient audio, avatar/clip availability check | async | per-asset retry, cache, procedural fallbacks |
| 13 | Package | assets + director script | `scene_manifest.json` (timeline built from audio durations) | async | n/a |
| 14 | Play / Export | manifest | live 3D playback; 1080p video export in the browser | client | FFmpeg fallback |
| 15 | Index | approved dream | embeddings, edges, insights | async | retry |

Safety check runs at stages 1, 3, and 4 (distress classifier) and before stage 12 (content abstraction).

## 5. Provider interfaces and ladders

All external capabilities go through interfaces in `/apps/api/providers/` (and matching adapters in the player for avatars and animation). Selection is by config, with automatic fallback.

```
LLMProvider:           generate_json(prompt, schema) -> dict       GeminiFree -> OllamaLocal
EmbeddingProvider:     embed(texts) -> vectors                      local only
TranscriptionProvider: transcribe(audio) -> text                    faster-whisper
ImageProvider:         generate_skybox / texture / backdrop(spec, style)
                       GeminiFreeImage -> LocalSD15 (LCM, ~512px + upscale) -> ProceduralSky/Texture
TTSProvider:           speak(text, voice_profile) -> audio buffer + word timings
                       Kokoro -> Piper   (Web Speech only for live preview: its audio cannot be captured)
AvatarProvider:        load_avatar(spec) -> glTF with viseme blendshapes
                       TalkingHead-compatible base -> VRoid/Blender avatar -> PrimitivePuppet
AnimationProvider:     clip(name) -> glTF animation
                       RPM/Mixamo library clips -> procedural (walk bob, idle sway)
```

**Fallbacks are real art options, not just safety nets.** ProceduralSky/Texture (gradient skies, noise textures, painted-looking fog) fits the dreamy look; PrimitivePuppet (capsule body, procedural walk, mouth flap) keeps the spike unblocked if avatar downloads fail.

**Why images still exist:** skyboxes, textures and painterly backdrop planes give the world its hand-painted feel. They are generated a handful per dream and cached, never per frame.

## 6. The dream world engine (real-time 3D)

### 6.1 Concept

The browser builds a stylized 3D world and performs the dream in it. An LLM acts as **director**: it writes a *director script* from a fixed action vocabulary. The player executes the script deterministically. Rigged cel-shaded characters walk, gesture and speak; the camera cuts between shots; the world itself can bend (dream logic).

### 6.2 Director script contract

Defined in `/packages/shared`; the player accepts nothing else. Shape (abbreviated):

```json
{
  "title": "...", "style_id": "nocturne_toon",
  "scenes": [{
    "scene_id": 1, "transition_in": "dissolve",
    "world": {"kit": "corridor", "sky": "dusk", "light": "moonlit",
              "fog": {"density": 0.2, "color": "#1b2a4a"},
              "props": [{"id": "locker_row", "anchor": "left_wall"}],
              "effects": [{"type": "flood", "at": 2.0, "duration": 4.0}]},
    "cast": [{"entity_id": "uuid|null", "name": "Companion", "spawn": "door_far", "face_visibility": "shadowed"}],
    "beats": [
      {"t": 0.0, "actor": "camera", "action": "shot", "args": {"preset": "wide", "duration": 3.0}},
      {"t": 0.5, "actor": "Companion", "action": "walk_to", "args": {"anchor": "center", "speed": "slow"}},
      {"t": 3.0, "actor": "Companion", "action": "speak", "args": {"line": "...", "emotion": "melancholic"}}
    ],
    "narration": null, "ambient": "underwater_hum", "sound_motif": "ticking"
  }]
}
```

**Action vocabulary (fixed):**

| Group | Actions |
|---|---|
| World | `set_kit`, `sky`, `light`, `fog`, `weather(rain\|snow\|ash\|none)`, `place_prop`, `effect(flood\|float\|invert_gravity\|loop\|stretch\|duplicate\|dissolve)` |
| Cast | `spawn`, `walk_to`, `run_to`, `animate(idle\|sit\|wave\|point\|shrug\|look_around\|fall\|reach\|think)`, `look_at`, `emote`, `speak`, `exit` |
| Camera | `shot(wide\|two_shot\|close_up\|hero_low\|over_shoulder\|top_down\|dolly_in\|tracking\|orbit)`, `drift` |
| Audio | `ambient`, `motif`, `narration` |
| Transitions | `cut`, `dissolve`, `morph`, `submerge_fade` |

Unknown actions or anchors are rejected by the validator; the LLM is retried with the error.

### 6.3 World composer

World kits (field, corridor, water, city, void, forest, interior) define procedural terrain (noise), prop sets, named **anchors** (positions for spawning and walking), and sky/light presets. Dream-logic effects are shader or transform animations with parameters (water rising, objects floating, gravity flip, corridor that loops, scale stretch, duplicated doors, dissolving geometry).

### 6.4 Cast

- One avatar per recurring entity (`cast_members`: avatar, outfit, colors), reused across dreams.
- Cel-shaded materials via the style preset; outfit colors from the palette.
- `face_visibility: full | shadowed | hidden` (hood, hair, back to camera, shadow mask) handles "known but not visible" faces.
- Locomotion: straight or spline paths between anchors with walk/run clips (no navmesh in v1).
- **Lip-sync:** TTS audio + word timings -> visemes -> blendshapes (TalkingHead-style). `emotion` selects a face preset and body clip.

### 6.5 Camera

A shot preset catalog in `config/render.yaml` (distance, height, FOV, target offset, motion). Auto-framing to the target actor, cuts or dissolves between shots, slow drift for a dreamlike feel. LLM chooses presets only; it never writes camera math.

### 6.6 Timing: audio first

TTS runs before layout. Beat times resolve against real audio durations; scene length = max(speech + pauses, min_scene_seconds), clamped to 3-10 s; total 30-60 s over 5-8 scenes.

### 6.7 Look

Toon ramp, outlines, palette LUT, film grain, soft bloom, vignette, slow color drift, subtle shimmer. All come from `config/styles/*.yaml` so a style is data, not code.

### 6.8 Player and export

- The **Dream Player** reads `scene_manifest.json` and plays everything live: instant preview, scrubbing, zero server render cost.
- **Export:** deterministic fixed-timestep rendering, frames encoded with WebCodecs, audio mixed with an offline audio context (local TTS buffer + ambient), muxed to MP4. If quality or compatibility is poor, a worker runs FFmpeg from the same manifest.

### 6.9 2D fallback

If 3D avatars become a blocker, characters can become billboard sprites with walk/idle sprite sheets inside the same 3D world ("HD-2D" look). The director contract stays the same; clips map to sprite animations.

## 7. Data model (summary)

Full DDL is built in Phase 2. Key tables:

- `users`, `dreams` (encrypted text columns), `dream_versions` (story + gap fills), `interpretations`
- `entities` (person, place, symbol, object, emotion, creature; with embedding), `dream_entity_links`, `entity_edges`
- `symbol_meanings` (per user, per entity: `meaning_label`, `probability`, `evidence_count`)
- `dream_embeddings`, `style_bibles` (toon preset + palette), `cast_members` (avatar, outfit, colors per entity; replaces character sheets), `render_jobs` (composition jobs), `insights`, `audit_log` (no dream content)

**Symbol meaning update (see `docs/LEXICON.md`):** Dirichlet-style counts per meaning label. "Resonates" adds weight to labels used in the chosen thread; "felt different" subtracts and may add a new label extracted from the user's note; evidence decays slowly with age.

**Retrieval:** (a) similar past dreams by vector similarity, (b) all prior appearances of matched entities with emotional context, (c) the learned meanings. Injected into reconstruction and interpretation as a context block.

## 8. GPU and memory scheduling (small-VRAM rule)

- A single **GPU lock** in the worker: one GPU-heavy job at a time.
- Order within a composition job: LLM director (remote) -> image generation for skyboxes/textures (GPU, then unload) -> TTS and ambient audio (CPU) -> package the manifest. The 3D render itself happens later in the browser.
- Load and unload models explicitly; call `torch.cuda.empty_cache()` after use.
- Local image generation: SD 1.5-class + LCM/Turbo-style few-step sampling at ~512 px, attention slicing/xformers or SDPA, then Real-ESRGAN upscale. Do not attempt SDXL/FLUX locally by default.
- Cache every asset by content hash so retries and re-renders are cheap.
- The worker GPU lock now only matters for local image generation. The player uses the browser GPU: stylized low-poly, one character first, 30+ fps live, 1080p export; degrade effects before frame rate.

## 9. Jobs and progress

- `POST /dreams/{id}/render` creates a `render_job` (idempotent).
- Worker stages report `{stage, percent}` via DB updates and SSE to the client.
- Stages: `director`, `textures_skybox`, `tts`, `ambient`, `package`.
- Retry per asset; resume from last successful stage; cancel supported.

## 10. API surface (v1)

```
POST /auth/*                      signup, login, logout, delete-account
POST /dreams                      create (text or audio upload URL)
GET  /dreams, /dreams/{id}        list, detail
POST /dreams/{id}/followups       generate questions
POST /dreams/{id}/answers         store answers
POST /dreams/{id}/reconstruct     mode=faithful|authored
PATCH /dreams/{id}/scenes/{sid}   correction -> regenerate scene
POST /dreams/{id}/approve
POST /dreams/{id}/interpret
POST /interpretations/{id}/feedback
POST /dreams/{id}/render, GET /render-jobs/{id}/events (SSE)
GET  /lexicon, /cast, /insights, /search?q=
POST /export, DELETE /me/data
```

## 11. Security and privacy architecture

- AES-GCM application-layer encryption for dream text; per-user data key wrapped by a master key from env.
- Repository layer enforces `user_id` on every query; tests prove cross-user access fails.
- Logging middleware strips bodies; log schema forbids content fields.
- Signed, expiring URLs for media.
- Prompt-injection defense: dream text is passed as data inside delimited blocks; outputs are schema-validated; no tool access from dream content.
- Distress classifier and content abstraction before rendering.

## 12. Build order (supersedes the order in the earlier build plan)

0. Rules, docs, repo scaffold (Docker Compose, hello-world services).
1. **3D spike (do this early):** hand-written director script -> cel-shaded world, one walking and speaking character, camera shots, audio, 1080p export. Go/no-go on look and laptop performance (see build plan Phase 1B).
2. Data model, auth, encryption.
3. Capture, follow-ups, extraction.
4. Reconstruction with flagged inferences and scene repair.
5. Interpretation and feedback.
6. Graph, embeddings, lexicon, insights.
7. Director script generation connected to the player.
8. Style presets and cast (avatars, outfits, persistent characters).
9. Frontend polish, journal, cast, lexicon, weather.
10. Safety, privacy hardening, export/delete.
11. Evals, observability, extras (multi-character scenes, sharing, Dream Book).

## 13. Decisions log (seed for `docs/DECISIONS.md`)

| Decision | Reason | Revisit when |
|---|---|---|
| Browser-based player, export optional | zero server render cost, instant preview | export quality is poor |
| Real-time cel-shaded 3D instead of depth-parallax images | walking, speaking characters and a world to move through | spike fails the look test or laptop performance |
| Kokoro/Piper over edge-tts | local, stable, no outside dependency | voice quality unsatisfactory |
| Gemini free tier as LLM default, Ollama fallback | quality now, privacy later | free quotas change |
| Image provider ladder with procedural fallback | free tiers are unstable; small GPU | local quality is enough |
| Lip-sync via blendshape visemes in v1 | characters must speak | non-English support is needed |
| Schemas in code, not markdown | single source of truth | n/a |
| Port TalkingHead/LiveAvatarStream3D modules, do not fork | big newscast product with cloud parts we do not use | a module needs heavy rework |
| Local TTS buffer for export | Web Speech audio cannot be captured | voice quality unsatisfactory |
| LLM writes director scripts from a fixed vocabulary | deterministic, validated, controllable | vocabulary too limiting for dream logic |
| 2D billboard sprites as fallback | if 3D avatars are blocked | avatars unavailable or too heavy |