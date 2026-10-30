# The Dream Machine: Phased Build Plan for Antigravity

A phase-by-phase plan with copy-paste prompts. Each phase is small enough for one agent conversation, ends with something runnable, and builds on the one before it.

---

## How to use this file with Antigravity

1. **Phase 0 first.** Save the "Global Project Rules" block as a workspace rule (or a `PROJECT_CONTEXT.md` in the repo root) so every agent conversation starts with the same understanding of the product.
2. **One phase per agent conversation.** Paste the phase prompt, nothing else. Don't batch phases.
3. **Plan before code.** Ask the agent to produce an implementation plan first (end of every prompt says so). Skim it and fix anything off *before* it writes files.
4. **Use the agent's task list / walkthrough artifacts** to verify what it actually did against the phase's "Done when" checklist.
5. **Commit after every phase.** Tag it (`phase-03-done`) so you can roll back cleanly.
6. **If a phase is too big for one conversation,** split it at the sub-bullets in the prompt and run them as consecutive conversations.
7. **Stack defaults below are suggestions.** Swap anything you prefer; just edit Phase 0 so the agent stays consistent.
8. **Updated direction (3D pivot):** Phase 1B, 8, 9 and 10 below replace the earlier 2.5D motion-comic versions. See `architecture.md` section 6 for the engine design and `prompts.md` P7/P8 for the runtime prompts.

---

## Product in one paragraph (the thing every phase must serve)

The Dream Machine turns broken, half-remembered dream fragments into (1) a coherent dream story that keeps dream logic, (2) a grounded psychological reading offered as *possible threads* rather than verdicts, (3) a personal dream graph that learns what each symbol means *to this user*, and (4) a 30-60 second cel-shaded 3D animated film performed live in the browser: a dream world with characters that walk, gesture and speak, directed by an LLM from a fixed action vocabulary. The soul of the product is the **recognition moment**: the user sees or hears their dream returned and thinks "yes, that's it."

## Principles (non-negotiable)

- **Dream logic is preserved, never flattened.** Emotional continuity beats physical continuity. No clichés.
- **Every inferred gap-fill is flagged** so the user can see and correct what the AI invented.
- **Interpretations are hypotheses with cited evidence from the user's own words.** No diagnostic language. No horoscope-style readings.
- **Symbols are personal.** Meaning is a learned distribution per user, not a fixed dictionary entry.
- **Animation is deterministic and real-time.** No text-to-video. One locked style per user, persistent character identities, validated director scripts.
- **Privacy and safety are core features,** not afterthoughts.

## Suggested stack (editable)

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind + Framer Motion |
| Backend API | Python FastAPI |
| DB | PostgreSQL + pgvector |
| Queue / workers | Redis + Celery (or RQ/arq) |
| Storage | S3-compatible (MinIO locally) |
| LLM | Provider-abstracted client (Gemini / Claude / OpenAI swappable) |
| Image gen (skyboxes/textures only) | Provider-abstracted client (free tier / local SD 1.5 / procedural fallback) |
| Speech-to-text | Whisper (API or local) |
| TTS | Kokoro (local) or Piper; Web Speech for preview only |
| 3D player | Three.js + TalkingHead (lip-synced avatars), cel-shaded look |
| Video export | WebCodecs + browser MP4 muxer (FFmpeg fallback) |
| Auth | Auth.js (NextAuth) or Supabase Auth |
| Infra | Docker Compose locally |

---

# PHASE 0: Project Charter and Global Rules

**Goal:** Give the agent permanent context so later phases stay consistent.

**Deliverables:** `PROJECT_CONTEXT.md` (and/or an Antigravity workspace rule), `docs/ARCHITECTURE.md` skeleton, `docs/DECISIONS.md`.

### Prompt 0.1: Global Project Rules (save as workspace rule)

~~~text
You are helping me build "The Dream Machine", a personal-project web app. Always follow this context.

PRODUCT
Users enter fragmented dream notes (voice or text). The system:
1. Reconstructs a coherent dream story (faithful mode or authored-arc mode), preserving dream logic and flagging every AI-inferred gap-fill.
2. Offers psychological interpretation as 2-3 selectable "possible threads", each grounded in evidence quoted from the user's own notes. Never diagnostic. Never generic dream-dictionary or horoscope style.
3. Maintains a Personal Dream Graph (people, places, symbols, emotions, dreams, with edges) plus vector embeddings, and learns per-user symbol meaning as a probability distribution updated by "That resonates" / "That felt different" feedback.
4. Performs the approved story as a 30-60s cel-shaded 3D animated film in a real-time browser player (Three.js): procedural dream world, rigged characters playing animation clips, lip-synced TTS, camera shots, ambient audio, WebCodecs export. The LLM only writes a validated director script from a fixed action vocabulary. NO text-to-video models.

ENGINEERING RULES
- Monorepo: /apps/web (Next.js + TS), /apps/api (FastAPI), /apps/worker (render + async jobs), /packages/shared (schemas), /docs, /infra.
- All LLM calls go through one provider-agnostic client with: structured JSON output validation (Pydantic), retries, timeouts, token/cost logging, and prompt versioning. Prompts live in /apps/api/prompts/ as versioned files, never inline.
- All pipeline stages are separate, individually testable functions with typed inputs/outputs.
- Long-running work (rendering) is asynchronous via a job queue with progress events.
- Never log raw dream text in application logs. Treat all dream content as highly sensitive.
- Write tests for each module. Prefer small commits per task.
- Before writing code for any task: produce a short implementation plan and list the files you will create or change. Wait for my approval on big structural decisions.
- When uncertain about a product decision, ask me instead of guessing.

TONE OF PRODUCT COPY
Gentle, curious, never clinical, never certain. Say "might", "one possible thread", "does this resonate?".
~~~

### Prompt 0.2: Architecture skeleton

~~~text
Create docs/ARCHITECTURE.md describing the pipeline stages: Capture -> Extract -> Retrieve -> Reconstruct -> Interpret -> Approve -> Director -> Compose -> Play. For each stage list: input, output, owner module, sync/async, and failure handling. Also create docs/DECISIONS.md as an ADR log with the stack choices from PROJECT_CONTEXT.md. Do not write application code yet. Show me the plan first.
~~~

**Done when:** Rules saved, docs exist, you've read and corrected them.

---

# PHASE 1: Repo Scaffold and Dev Environment

**Goal:** One command boots the whole system.

**Deliverables:** Monorepo, Docker Compose (Postgres+pgvector, Redis, MinIO), FastAPI hello-world, Next.js hello-world, worker hello-world, env management, CI lint/test.

### Prompt 1.1

~~~text
Scaffold the monorepo described in PROJECT_CONTEXT.md.

Requirements:
- docker-compose.yml with: postgres (pgvector image), redis, minio, api, worker, web. Healthchecks on all.
- /apps/api: FastAPI with /health endpoint, settings via pydantic-settings, structured logging that NEVER logs request bodies.
- /apps/worker: Celery (or arq) app connected to Redis with one sample task and a progress-reporting helper.
- /apps/web: Next.js App Router + TypeScript + Tailwind, a placeholder home page, and a typed API client generated from the FastAPI OpenAPI schema.
- /packages/dream-player: Vite + TypeScript + Three.js package with a placeholder spinning cube page.
- .env.example with every variable documented.
- Makefile or justfile: make up, make down, make test, make lint, make migrate.
- GitHub Actions workflow running lint + tests for api and web.

First give me an implementation plan and file tree. Then implement. At the end, give me exact commands to verify everything boots and a checklist of what you tested.
~~~

**Done when:** `make up` starts everything; `/health` returns OK; the web page loads; the sample worker task completes.

---

# PHASE 1B: 3D Dream World Spike (go/no-go)

**Goal:** Prove the look and the laptop performance before building the rest. No backend, no LLM: a hand-written director script plays as a real-time cel-shaded 3D film.

**Deliverables:** `/packages/dream-player` spike, `samples/spike.director.json`, `scripts/fetch-avatars.sh` and `fetch-animations.sh`, `THIRD-PARTY-NOTICES.md`, `docs/SPIKE_REPORT.md`.

### Prompt 1B.1: Build the spike

~~~text
Build a standalone spike in /packages/dream-player (Vite + TypeScript + Three.js). No backend, no LLM. Goal: play a hand-written ~40 second director script JSON as a real-time cel-shaded 3D animation. Read architecture.md section 6 first.

1. World
 - Procedural ground (noise heightfield), gradient sky with stars, exponential fog, moonlit lighting, 10-20 simple low-poly props (doors, floating clocks, lockers) placed at named anchors.
 - One dream-logic effect: a water plane rising over ~4 seconds (flood) with a subtle wave shader.
2. Look
 - Cel-shading: toon gradient ramp (3-4 bands) plus outlines (inverted hull or post-process), palette from config/styles/nocturne_toon.yaml, film grain, soft bloom, vignette. All values read from the YAML.
3. Character
 - Use TalkingHead (MIT) in avatar-only mode with a compatible rigged avatar fetched by scripts/fetch-avatars.sh (never commit models). Apply a toon material to it.
 - Walk, idle and gesture clips fetched by scripts/fetch-animations.sh (never commit; record terms in THIRD-PARTY-NOTICES.md).
 - Fallback if downloads fail: PrimitivePuppet (capsule body, procedural walk bob, mouth flap) so the spike is never blocked.
 - The character walks from anchor A to B, then speaks a line with lip-sync.
4. Speech
 - Synthesize the line with a free local TTS (Kokoro via kokoro-js in the browser, or a small local script) into an audio buffer with word timings; drive visemes from it. Web Speech may be used for live preview only.
5. Camera
 - Shot presets from config/render.yaml: wide, tracking, close_up, hero_low. The script cuts between 4 shots with one dissolve.
6. Audio
 - Web Audio ambient bed (procedural drone + wind) and one recurring ticking motif mixed under speech.
7. Player
 - Load /samples/spike.director.json; play, pause, scrub; show FPS.
8. Export
 - 1080p export using fixed-timestep rendering, WebCodecs encoding and an MIT-licensed browser MP4 muxer (verify its license); mix audio offline and mux it in.

Constraints: target 30+ fps at 1080p preview on a laptop with 16 GB RAM and a ~4 GB VRAM RTX 2050; keep triangle counts low; read all tunables from config files; record every external asset and its license in THIRD-PARTY-NOTICES.md.

First give an implementation plan and file tree. Then implement in small commits.
~~~

### Prompt 1B.2: Spike report

~~~text
Run the spike and write docs/SPIKE_REPORT.md: measured FPS (preview and during export), export time, memory use, what failed, asset or license problems, 4 screenshots from different shots, and the 5 biggest visual weaknesses. Do not fix anything yet.
~~~

**Go / no-go (you decide, not the agent):**
- Does it feel like a dream rather than a game tutorial?
- Does the character read as walking and speaking naturally?
- Is the style recognizably yours?
- 30+ fps on your laptop, and export works without paid keys?
- If not: tune the shader and shots first; then try the PrimitivePuppet or billboard-sprite fallback (`architecture.md` 6.9) before abandoning 3D.

---

# PHASE 2: Data Model, Auth, Encryption

**Goal:** Secure user accounts and the core schema, including graph-shaped tables.

**Deliverables:** Migrations (Alembic), auth, per-user data isolation, field-level encryption for dream text.

### Prompt 2.1: Schema

~~~text
Design and implement the database schema with Alembic migrations (PostgreSQL + pgvector).

Tables (adjust names sensibly, but keep this structure):
- users (id, email, created_at, settings jsonb, style_bible_id nullable)
- dreams (id, user_id, captured_at, raw_text_encrypted, raw_audio_key nullable, transcript_encrypted nullable, mood_on_waking nullable, recent_life_context_encrypted nullable, status enum[captured, extracted, reconstructed, interpreted, approved, rendering, rendered, failed])
- dream_versions (id, dream_id, mode enum[faithful, authored], story_json, gap_fills_json, created_at, is_approved)
- entities (id, user_id, type enum[person, place, symbol, object, emotion, creature], canonical_name, aliases text[], description, first_seen_dream_id, embedding vector, character_sheet_id nullable)
- dream_entity_links (dream_id, entity_id, role, salience float, emotion_valence float)
- entity_edges (id, user_id, source_entity_id, target_entity_id, relation_type, weight, evidence_dream_ids uuid[])
- symbol_meanings (id, user_id, entity_id, meaning_label, probability float, evidence_count int, updated_at)  -- the per-user learned distribution
- interpretations (id, dream_id, threads_json, selected_thread_index nullable, feedback enum[resonates, felt_different, none], feedback_note)
- dream_embeddings (dream_id, summary_embedding vector, emotion_embedding vector)
- render_jobs (id, dream_id, status, progress, stage, error, output_video_key, screenplay_json)
- style_bibles (id, user_id, style_name, style_prompt, negative_prompt, reference_image_keys text[], palette jsonb, locked bool)
- character_sheets (id, user_id, entity_id, image_keys jsonb, visual_description)
- audit_log (id, user_id, action, at)  -- no dream content ever

Rules:
- Dream text columns are encrypted at the application layer (AES-GCM, per-user data key wrapped by a master key from env). Provide helper functions and tests.
- Add pgvector indexes (HNSW or IVFFlat) on embedding columns.
- Row-level scoping: every query must be filtered by user_id; implement a repository layer that enforces it so no route can forget.

Give me the plan and an ER diagram (mermaid) first. Then implement migrations, models, repositories, and tests proving user A can never read user B's rows.
~~~

### Prompt 2.2: Auth

~~~text
Add authentication: email + password with secure hashing and session cookies (or Auth.js with the credentials/email provider). Include signup, login, logout, and a "delete my account and all data" endpoint that hard-deletes DB rows and storage objects. Add a settings table field for privacy options: local_only_mode (placeholder), allow_sharing default false. Write tests. Plan first.
~~~

**Done when:** You can register, log in, and the isolation tests pass.

---

# PHASE 3: Dream Capture (Voice First)

**Goal:** Capturing a dream feels effortless, even half-asleep.

**Deliverables:** Capture UI, audio recording, transcription, follow-up questions.

### Prompt 3.1: Capture UI and transcription

~~~text
Build the dream capture flow.

Frontend:
- A calm, dark, low-contrast capture screen (usable at 6 AM with sleepy eyes). Large single-tap record button, live waveform, text input alternative, optional "how did you feel on waking?" emoji row, and an optional collapsible "recent life context (stress, events)" field.
- Audio is recorded with MediaRecorder, uploaded to storage via presigned URL, and the raw audio is kept.
- Auto-save drafts so nothing is lost if the tab closes.

Backend:
- POST /dreams creates a dream in status "captured".
- Transcription service using Whisper behind an interface (TranscriptionProvider) with two implementations: API and local faster-whisper. Preserve filler words and hesitations in a raw_transcript field, plus a lightly cleaned transcript.
- Never log transcript content.

Add tests with a fixture audio file. Plan first.
~~~

### Prompt 3.2: Smart follow-up questions

~~~text
Implement the "follow-up questions" step. After capture, call the LLM with the raw notes and return 2 or 3 questions maximum.

Question rules (put these in apps/api/prompts/followups_v1.md):
- Prioritize emotion and sensation over objects (e.g. "What did the air feel like?", "Were you scared, or just uneasy?").
- Only ask about something genuinely ambiguous or emotionally central.
- Never suggest answers. Never lead.
- Each question is skippable.
- Output strict JSON: {"questions": [{"id": str, "text": str, "targets": "emotion|sensation|character|transition|ending"}]}

Frontend: show the questions one at a time as a gentle conversational step with a clear "skip" and "that's enough, weave it" button. Store answers appended to the dream's context. Plan first.
~~~

**Done when:** You can speak a dream, see a transcript, answer or skip 2-3 questions.

---

# PHASE 4: Extraction Stage

**Goal:** Turn messy notes into structured data the rest of the system can use.

### Prompt 4.1

~~~text
Implement the Extract stage: raw notes + follow-up answers -> structured JSON.

Output schema (Pydantic, strict):
{
  "fragments": [{"id", "text", "order_hint", "certainty": "vivid|vague|uncertain"}],
  "entities": [{"name", "type", "description_from_user", "is_known_person": bool, "salience": 0-1}],
  "emotions": [{"label", "intensity": 0-1, "attached_to": fragment_id|null}],
  "transitions": [{"from": fragment_id, "to": fragment_id, "type": "cut|morph|submerge|fall|unexplained"}],
  "day_residue_candidates": [str],
  "ending": "text or null"
}

Rules:
- Keep the user's own words in description_from_user; do not paraphrase them into generic language.
- Do not add anything that is not in the notes. Extraction is faithful, not creative.
- Store prompt at apps/api/prompts/extract_v1.md. Add 10+ golden test cases of messy dream notes with expected structure (checked loosely, not exact text).

After extraction, resolve entities against the user's existing entities (match by alias, then by embedding similarity above a threshold, with an "ask the user" fallback for ambiguous matches such as "is this the same Grandpa from before?"). Plan first.
~~~

**Done when:** Messy input yields valid JSON; entity matching links "the old friend with clock hands" across dreams.

---

# PHASE 5: Reconstruction Engine (The Dream Weaver)

**Goal:** The core magic: gap infilling that keeps dream logic.

### Prompt 5.1: Reconstruction prompts and service

~~~text
Implement the Reconstruct stage with two modes.

Inputs: extracted structure, raw notes, follow-up answers, retrieved history snippets for recurring entities (from Phase 7 later; for now accept an optional list).

Mode A, Faithful: keep every user-provided detail and irregularity; only resolve abrupt cuts into smooth visual flow and complete the dialogue. Do not add a moral, closure, or explanation unless the user gave one.
Mode B, Authored Arc: restructure into a short cinematic story (setup, escalating surreal conflict, thematic closure) while still honoring every fragment.

Hard rules (put in apps/api/prompts/reconstruct_v1.md):
- Preserve dream logic: non-linear causality, impossible geometry, emotional continuity over physical continuity.
- Avoid clichés (no "it was all a dream", no generic falling-then-waking unless the user said it).
- Output scenes with each paragraph/line tagged: {"text": str, "source": "user" | "inferred", "inference_reason": str | null, "confidence": 0-1}
- Every sentence that is "inferred" MUST have an inference_reason explaining the bridge (e.g. "connects hallway to underwater: both feel like being unable to leave").
- Provide: title, 5-8 scenes, dialogue lines with speaker and emotion label.

Return JSON validated by Pydantic and store as a dream_version. Add a mock LLM for tests plus a small evaluation script that checks: all user fragments are represented, every inferred item has a reason, no forbidden cliché phrases.

Plan first.
~~~

### Prompt 5.2: Reconstruction review UI (the recognition moment)

~~~text
Build the reconstruction review screen.

- Display the story with inferred passages subtly tinted. Hovering/tapping one shows the inference_reason.
- Each scene has actions: "This isn't how it was" (opens a box: tell me what's different, regenerate ONLY that scene with that correction while keeping neighbors consistent), "Keep", and inline edit.
- Toggle between Faithful and Authored versions without losing edits.
- A "That's my dream" approve button moves the dream to the next stage.
- Smooth, slow, atmospheric reveal animation (text fades in scene by scene).
- Each user correction is logged as feedback data (without being written to application logs).

Backend: PATCH endpoint for partial scene regeneration with the correction as additional context. Plan first.
~~~

**Done when:** You can generate, correct a single scene, regenerate it, and approve.

---

# PHASE 6: Interpretation Engine

**Goal:** Grounded, humble, evidence-based readings.

### Prompt 6.1

~~~text
Implement the Interpret stage producing 2 or 3 "possible threads".

Each thread (apps/api/prompts/interpret_v1.md):
{
  "lens": "cognitive_emotional | jungian | day_residue | relational",
  "title": str,
  "reading": str (2-4 sentences, tentative language),
  "evidence": [{"quote_from_user": str, "why_it_matters": str}],   // quotes MUST be verbatim substrings of the user's notes or follow-up answers; validate this in code and reject otherwise
  "waking_life_questions": [str]  // gentle reflective questions for the user, max 2
  "symbols": [{"name": str, "possible_meaning": str}]
}

Hard rules:
- No diagnostic language (no "anxiety disorder", "trauma response", etc.).
- No generic dream dictionary claims ("water means emotions").
- If the user's recent_life_context exists, connect to it explicitly; if not, do not invent stressors.
- If retrieved personal symbol history exists, use the user's learned meaning for a symbol and say so ("In your earlier dreams, water tended to feel calming to you").
- Tone: "might", "one possible thread", never "this means".
- Include a "this might just be a dream" option; the user can always skip interpretation.

Add a code-level validator that checks the verbatim-quote rule and bans a configurable list of diagnostic terms. Add tests. Plan first.
~~~

### Prompt 6.2: Interpretation UI and feedback

~~~text
Build the interpretation screen: 2-3 thread cards the user can open. Each card has "That resonates" / "That felt different" buttons plus an optional note ("how was it different?"). Include a quiet "Skip interpretation" link. Selecting a thread and giving feedback writes to the interpretations table and enqueues a lexicon update event (the handler can be a stub until Phase 7). Plan first.
~~~

**Done when:** Threads show with verifiable quotes, feedback is stored.

---

# PHASE 7: Personal Dream Graph and Lexicon

**Goal:** The moat. The system learns *this user*.

### Prompt 7.1: Graph and embeddings

~~~text
Implement the Personal Dream Graph services.

1. After a dream is approved, embed: a dream summary, an emotion-profile text, and each entity description. Use an EmbeddingProvider interface.
2. Maintain entities and entity_edges: co-occurrence edges, "preceded_by" edges between dreams, "same_as" candidates.
3. Retrieval function get_relevant_history(user_id, dream) returning: (a) similar past dreams by vector similarity, (b) all prior appearances of each matched entity with their emotional context, (c) the learned symbol meanings. This must feed Reconstruct and Interpret prompts via an additional context block.
4. Write a repository + service layer with tests using synthetic multi-dream fixtures (e.g. 12 dreams where "locked transit gates" recurs).

Plan first and include the graph queries you intend to use.
~~~

### Prompt 7.2: Learned symbol meanings

~~~text
Implement the symbol meaning learner.

- symbol_meanings stores, per user and entity, a probability distribution over meaning labels (e.g. water: calming 0.7, threatening 0.3).
- Initial priors come from the LLM's generic read, kept deliberately weak (low evidence_count).
- Each "resonates" feedback increases the weight of the meaning labels used in the chosen thread; "felt different" decreases them and, if the user added a note, extracts a new meaning label from it and adds it with moderate weight.
- Use a simple Bayesian/Dirichlet-style update, documented in docs/LEXICON.md, with decay so old evidence matters slightly less over time.
- Expose GET /lexicon so the frontend can show "what your symbols mean to you".

Add unit tests for the update math and an integration test where feedback over several dreams measurably shifts the distribution. Plan first.
~~~

### Prompt 7.3: Longitudinal insights and Dream Weather

~~~text
Implement the pattern detector as a scheduled job.

- Detect recurring motifs (entity or symbol appearing in 3 or more dreams within a window), emotional trend shifts, new vs. repeating elements, recurring characters and places.
- Correlate with the user's saved recent_life_context entries (only when they provided them) to produce proactive, tentative insights, e.g. "Locked gates have appeared in 3 dreams this month, each around weeks where you noted deadlines."
- Build the "Dream Weather" report: weekly/monthly summary with dominant emotions, top recurring symbols, and a sentence of reflection. Store as insights rows.
- Insights must always be dismissible and phrased tentatively; never alarmist.

API + a simple dashboard page. Add tests with synthetic timelines. Plan first.
~~~

**Done when:** Past dreams change how new dreams are reconstructed and interpreted; the lexicon visibly updates; insights appear.

---

# PHASE 8: Director Script Generation

**Goal:** The LLM turns the approved story into a validated director script the player can perform.

**Deliverables:** Director schema and action vocabulary in `/packages/shared`, world kit registry, validator, `director_v1` prompt, CLI.

### Prompt 8.1

~~~text
Implement the Director stage (architecture.md 6.2, prompts.md P7).

- Define the director script schema in /packages/shared (Pydantic + generated TypeScript) with the fixed action vocabulary as enums: world, cast, camera, audio, transitions.
- Create config/world_kits/*.yaml for 7 kits (field, corridor, water, city, void, forest, interior), each with named anchors, props and sky/light presets, plus a registry loader.
- Implement the validator rules from prompts.md P7 (vocabulary, anchors, cast reuse by entity_id, 5-8 scenes, camera opener, no repeated consecutive shot preset, speak beats have lines).
- Implement the stage using prompt apps/api/prompts/director_v1.md, retry with validator errors, and a mock LLM for tests.
- Add 10 sample approved stories with expected valid scripts (checked structurally, not word for word).
- CLI: `python -m api.director --story story.json --style nocturne_toon`.

Plan first.
~~~

**Done when:** Any approved dream yields a valid director script that the spike player can perform.

---

# PHASE 9: Style Presets and Cast

**Goal:** One locked look per user and recurring characters that stay the same across dreams.

### Prompt 9.1: Style presets

~~~text
Implement style presets as data.

- config/styles/*.yaml with 4-5 presets (ink-wash toon, soft gouache toon, muted risograph, nocturne watercolor, paper-cut silhouette): toon ramp, outline settings, palette, grain/bloom/vignette, sky preset, image_style_prompt and negative prompt.
- Style picker UI that renders the three fixed test scenes (prompts.md P12) live in the player with each preset; the choice is locked per user (changing it later shows a warning).
- ImageProvider ladder for skyboxes/textures/backdrops per prompts.md P8: free API -> local SD 1.5 (LCM, ~512 px, upscale) -> procedural sky/texture. A provider failure must never block composition.

Plan first.
~~~

### Prompt 9.2: Cast

~~~text
Implement persistent cast members.

- cast_members table (entity_id, avatar_id, outfit, colors, face_visibility default, lineage for new looks).
- On a character's first appearance, choose an avatar and outfit/colors from a small curated set, with the LLM suggesting based on the user's own description (for example "tall, grey coat"); the user can edit.
- Reuse the same cast member in later dreams; support a "new look" variant that keeps lineage.
- Cast page with a 3D turntable preview, the dreams each character appears in, and a regenerate-with-note option.
- Handle "known but not visible" faces with shadowed/hidden face_visibility (hood, hair, back to camera, shadow mask).

Plan first.
~~~

**Done when:** The same character looks the same in two different dreams; the style stays locked.

---

# PHASE 10: Dream Player and World Composer (Production)

**Goal:** Turn the spike into the real engine and connect it to the backend.

### Prompt 10.1: Harden the player

~~~text
Harden the spike in /packages/dream-player into the production player.

- World kits for all 7 kits with anchors and props; the 7 dream-logic effects (flood, float, invert_gravity, loop, stretch, duplicate, dissolve); weather (rain, snow, ash).
- Cast: avatars, outfit colors, animation clips for every cast action in the vocabulary, locomotion along straight or spline paths between anchors, gaze via look_at, emotion presets for face and body.
- Lip-sync from TTS audio and word timings via visemes.
- Camera: all 9 shot presets from config/render.yaml with auto-framing, cuts, dissolves, slow drift.
- Transitions: cut, dissolve, morph, submerge_fade.
- Audio: ambient presets, recurring motifs, speech ducking.
- Deterministic timeline built from real audio durations (architecture.md 6.6), scrubbable.
- Tests: timeline math, director-script validator integration, and snapshot tests of scene state at fixed timestamps.

Plan first.
~~~

### Prompt 10.2: Asset stage (worker)

~~~text
Implement worker tasks that prepare a scene manifest from a director script:

1. TTS per speak/narration beat with Kokoro (Piper fallback), returning audio plus word timings.
2. Ambient audio from presets and procedural generation (numpy/scipy), plus motif sounds.
3. Skybox/textures/backdrops through the ImageProvider ladder (prompts.md P8) with procedural fallbacks.
4. Check avatar and clip availability; fall back to PrimitivePuppet where missing.
5. Package scene_manifest.json (timeline from audio durations, asset URLs, style preset).

Report progress per stage (director, textures_skybox, tts, ambient, package) over SSE. Cache every asset by content hash; retry only failed assets. Plan first.
~~~

### Prompt 10.3: Orchestration and export

~~~text
Wire the full flow: POST /dreams/{id}/render (idempotent) -> director script -> assets -> manifest -> player. Add progress events, cancel, and retry-from-stage. Browser export: fixed-timestep rendering, WebCodecs encoding, offline audio mix, MP4 mux. Add an FFmpeg worker fallback that renders from the same manifest if browser export fails. Store the manifest and final video key in render_jobs. Plan first.
~~~

**Done when:** One click on an approved dream plays, then exports, a 30-60 s film, with no paid keys.

---

# PHASE 11: Frontend Experience and Polish

**Goal:** It should *feel* like a dream, not a dashboard.

### Prompt 11.1: Design system

~~~text
Create the design system and app shell.

- Aesthetic: dreamlike, nocturnal, soft gradients, subtle grain, slow easing, generous spacing, serif display type with a clean sans for UI. Dark mode default.
- Components: buttons, cards, modals, scene cards, thread cards, timeline, tag chips, toasts, skeleton loaders that feel atmospheric (slow shimmer).
- Motion principles: slow fades, no jarring snaps, reduced-motion support.
- Accessibility: keyboard navigation, contrast checks, captions on all playback, screen reader labels.

Build a /design page showing all components. Plan first.
~~~

### Prompt 11.2: Core screens

~~~text
Build and connect the main screens using the existing API:
1. Home / Morning capture
2. Reconstruction review (Phase 5)
3. Interpretation (Phase 6)
4. Rendering progress screen: a calm animated waiting experience with stage messages ("gathering the fragments", "painting the backdrops", "giving voices to shadows")
5. Player: cinematic video player with captions, scene scrubber, and the story/meaning panel alongside
6. Journal: searchable timeline of dreams with thumbnails, filters by emotion/symbol/character/location, and semantic search ("dreams about being lost")
7. Cast and Lexicon pages
8. Dream Weather / Insights
9. Settings (style, privacy, export, delete)

Make flows resumable: leaving mid-way never loses work. Plan first and propose the route map.
~~~

### Prompt 11.3: Morning ritual

~~~text
Add the wake-up ritual: optional daily reminder at the user's chosen wake time (web push; email fallback), a deep link that opens straight into voice capture, and a gentle "no dream today" one-tap that logs a blank day without guilt. Keep notification copy soft and never nagging. Plan first.
~~~

---

# PHASE 12: Privacy, Safety, and Trust

**Goal:** Dreams are the most intimate data people have. Treat them that way.

### Prompt 12.1: Privacy hardening

~~~text
Harden privacy.

- Verify no dream content appears in logs, error trackers, analytics, or LLM provider logs where avoidable (configure provider flags for no-training / zero retention where supported).
- Add data export (full JSON + media zip) and verified hard delete for everything including storage objects and embeddings.
- Add an optional "local-only mode" design doc (and stub flag) describing how transcription and embeddings could run locally.
- Rate limiting, CSRF protection, secure headers, signed expiring URLs for all media.
- Write docs/PRIVACY.md in plain language describing exactly what is stored and where.
- Security test checklist covering IDOR, injection, and prompt injection via dream text (dream content must never be able to change system instructions or exfiltrate other users' data).

Plan first.
~~~

### Prompt 12.2: Distress and content safety

~~~text
Implement safety handling.

- A lightweight classifier step on incoming notes and follow-up answers detecting signs of acute distress, self-harm ideation, or abuse disclosure.
- If triggered: pause the cheerful pipeline, respond with a warm, non-clinical, supportive message, offer to continue privately without animation, and show appropriate region-aware support resources. Do not interpret or animate in that state unless the user chooses to continue. Never claim to be therapy.
- Graphic or disturbing dream content renders in an abstracted symbolic style by default, with a user setting to change it.
- Add an "interpretation is reflection, not diagnosis" note in a gentle place in the UI (not a scary disclaimer wall).
- Tests with sensitive synthetic examples; document behavior in docs/SAFETY.md. Plan first.
~~~

---

# PHASE 13: Sharing and Export

**Goal:** A growth loop and keepsakes, strictly opt-in.

### Prompt 13.1

~~~text
Implement opt-in sharing and export.

1. Share a dream as a public link or short video: user chooses what is visible (video only, story, meaning), names are stripped and replaced by neutral labels automatically with a preview before publishing, revocable at any time.
2. Auto-generate a vertical 9:16 cut and a looping GIF/short preview for social.
3. "Dream Book": export a selected range of dreams as a beautifully typeset PDF (story, key frames, symbols, optional interpretations) and a compilation video.
4. Open Graph cards for shared links.

Plan first.
~~~

---

# PHASE 14: Quality, Evals, Observability, Deployment

**Goal:** Make it reliable and improvable.

### Prompt 14.1: Evals

~~~text
Build an evaluation harness in /apps/api/evals:
- A dataset of 30+ synthetic fragmented dreams of varying difficulty (very short, emotional-only, multi-scene, dialogue-heavy).
- Automated checks: fragment coverage, inferred-gap flagging, cliche detection, verbatim evidence quotes, banned diagnostic terms, screenplay schema validity and duration range.
- LLM-as-judge rubric for "dream logic preserved", "tone tentative", "consistency with history", with scores stored per prompt version so I can compare prompt_v1 vs v2.
- A CLI report. Plan first.
~~~

### Prompt 14.2: Observability and cost

~~~text
Add observability that never captures dream content: metrics per pipeline stage (latency, failure rate, retries), per-provider cost tracking per dream, render queue depth, and alerting thresholds. Add a simple admin dashboard (metadata only). Add per-user daily limits for render jobs to control cost. Plan first.
~~~

### Prompt 14.3: Deployment

~~~text
Prepare production deployment: container images, a deploy guide for a single VPS or a managed container platform, managed Postgres with pgvector, object storage, a GPU/CPU worker strategy with autoscaling notes, secrets management, backups with encryption, and a staging environment. Include a runbook in docs/RUNBOOK.md. Plan first.
~~~

---

# PHASE 15: Future Experiments (Optional, After v1 Feels Great)

| Idea | Prompt seed |
|---|---|
| Multi-character scenes | "Support 2-3 characters in one scene with conversation camera logic (over-shoulder, two-shot), turn-taking and gaze, still driven by the director vocabulary." |
| Dream episodes | "Detect when a dream is a continuation of an earlier one and group them into a named series with an episode timeline and a 'previously on...' recap clip." |
| Lucid dreaming nudges | "Using the user's own recurring symbols, suggest personalized reality-check cues and a gentle pre-sleep intention prompt. Opt-in only, no medical claims." |
| Dream-to-dream remix | "Let the user explore 'what if' branches of a dream and render alternate endings as separate versions." |
| Multi-language | "Support capture and narration in Hindi and English, including TTS voices and bilingual captions." |
| Local-only mode | "Implement fully local transcription (faster-whisper), local embeddings, and local LLM option so no dream content leaves the device." |

---

## Appendix A: Runtime prompt seeds (starting points for /apps/api/prompts/)

### A1. Reconstruction (system prompt core)

~~~text
You are the Dream Weaver. You reconstruct a person's dream from fragments.

Principles:
- Dreams run on emotional logic. Keep emotional continuity even when physical continuity breaks.
- Never make the dream ordinary. Impossible places, shifting identities, and unexplained transitions are features.
- Every detail the user gave must survive. Mark each sentence as "user" or "inferred". For each "inferred" sentence, explain the bridge in one line.
- Avoid clichés and moral summaries unless the user supplied them.
- Write sensory, concrete, quiet prose. Dialogue should sound like dream speech: slightly off, emotionally true.
- Use the provided history only to keep recurring characters and places consistent; do not import new events from it.

Return only valid JSON matching the schema.
~~~

### A2. Interpretation (system prompt core)

~~~text
You help a person reflect on their dream. You are not a therapist and you do not diagnose.

Offer 2-3 possible threads from different lenses. For each, quote the user's own words verbatim as evidence and explain gently why they might matter. Use tentative language ("might", "one possible thread"). Connect to the person's recent life context only if they supplied it. If personal symbol history is provided, prefer the person's learned meanings over general ones and say so.

Never use diagnostic or clinical labels. Never state what a symbol "means" universally. End each thread with at most two open, gentle questions for the person to consider.

Return only valid JSON matching the schema.
~~~

---

## Appendix B: Per-phase "Done when" checklist template

Paste this at the end of any phase prompt to get verifiable output from the agent:

~~~text
When finished, provide:
1. A list of every file created/changed.
2. Exact commands to run and test.
3. A checklist mapping each requirement above to where it is implemented and how it was tested.
4. Known limitations and anything you decided on my behalf that I should review.
~~~