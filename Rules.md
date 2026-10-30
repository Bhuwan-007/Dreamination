# rules.md: The Dream Machine

> Always-on rules for every agent conversation. Keep this file short. Details live in `prd.md` (what), `architecture.md` (how), `prompts.md` (runtime LLM prompts), `design.md` (look and feel, added later).

## 1. What this product is

The Dream Machine turns fragmented dream notes into (1) a coherent dream story, (2) a humble, evidence-based reflection, (3) a personal dream graph that learns what each symbol means to *this user*, and (4) a 30-60 second cel-shaded 3D animated film rendered live in the browser: a dream world with characters that walk, gesture and speak. The goal is the **recognition moment**: the user sees their dream returned and thinks "yes, that's it."

## 2. Product rules (never violate)

1. **Preserve dream logic.** Emotional continuity beats physical continuity. No clichés ("it was all a dream"), no forced moral, no flattening into ordinary logic.
2. **Flag every inference.** Anything the AI invented to bridge a gap is marked `source: "inferred"` with a one-line `inference_reason`, and is visible and editable in the UI.
3. **Interpretation is a hypothesis.** Offer 2-3 "possible threads". Every thread quotes the user's own words **verbatim** (validated in code). No diagnostic or clinical language. No dream-dictionary claims ("water means emotions").
4. **Symbols are personal.** Symbol meaning is a learned probability distribution per user, updated by "That resonates" / "That felt different" feedback.
5. **Animation is deterministic and real-time.** A Three.js 3D scene: procedural dream world, rigged cel-shaded characters playing library animation clips, lip-synced TTS, camera shots, all driven by an LLM-written *director script* from a fixed action vocabulary. No text-to-video models. One locked art style (toon shader + palette) per user; recurring characters keep one identity.
6. **Tone of all copy:** gentle, curious, never certain. Use "might", "one possible thread", "does this resonate?".
7. **The user is always in control:** can skip interpretation, skip animation, correct any scene, export everything, delete everything.

## 3. Free-first rule

The project must run with **zero paid services** by default.

- Every external capability sits behind a **provider interface** with a free default and a local fallback (see `architecture.md` section 5). Never hard-code a vendor.
- Never add a dependency that requires a paid plan, credits, or a credit card.
- Check a library's license before adding it. Prefer MIT / Apache-2.0 / BSD. Flag anything non-commercial in `docs/DECISIONS.md`.
- Free API tiers change without notice: always implement backoff, caching, and a local or procedural fallback.
- Record every external 3D asset (avatar, animation clip, texture, sound) and its license in `THIRD-PARTY-NOTICES.md`. Assets whose terms forbid redistribution are fetched by setup scripts and never committed.

## 4. Hardware constraints (dev machine)

Laptop with 16 GB RAM and a small NVIDIA RTX 2050 GPU (about 4 GB VRAM).

- **Run GPU jobs one at a time.** Never hold two models in VRAM. Load, run, unload, free memory.
- Local image generation must target small models (SD 1.5-class with LCM/Turbo-style fast sampling at ~512 px, then upscale). Do not assume SDXL/FLUX locally.
- Prefer CPU-friendly models for everything else (embeddings, Kokoro/Piper, faster-whisper small).
- **Browser render budget** (the player runs on the same laptop GPU): stylized low-poly scenes, one character on screen at first, modest post-processing, 1080p export (not 4K). Keep 30+ fps live; degrade effects before frame rate.
- Image generation is only for skyboxes, textures and backdrops, so quality or quota problems must never block a render (procedural sky/texture fallback).
- Every long task runs in the worker queue with progress events. Never block an HTTP request on rendering.

## 5. Engineering rules

- Monorepo: `/apps/web` (Next.js + TypeScript), `/apps/api` (FastAPI), `/apps/worker` (async jobs and render), `/packages/shared` (schemas), `/docs`, `/infra`.
- **Schemas are code.** Pydantic models in `/packages/shared` are the single source of truth; generate TypeScript types from them. Do not duplicate schemas in markdown.
- **Prompts live in files** under `/apps/api/prompts/` (versioned: `extract_v1.md`, `extract_v2.md`). Never inline prompts in code.
- **One LLM client** with: strict JSON validation (Pydantic), retries with backoff, timeouts, token/cost logging, prompt-version tagging, and caching by input hash.
- **The Director script (JSON) is the only contract between the LLM and the 3D player.** Fixed action vocabulary lives in `/packages/shared`; unknown actions are rejected by the validator. The player never receives free text to interpret.
- Every pipeline stage is a typed, individually testable function.
- Tests for each module. Use a mock LLM and mock image provider in tests.
- Small commits. One feature per commit.
- Use TypeScript strict mode; use Ruff + mypy (or pyright) on Python.

## 6. Privacy and safety rules

- **Never log dream content** (notes, transcripts, stories, interpretations, prompts containing them). Log IDs, stage names, durations, and error codes only.
- Dream text is encrypted at the application layer (AES-GCM). Every DB query is scoped by `user_id` through the repository layer; no raw cross-user queries.
- Treat dream text as **untrusted input**: it must never be able to change system instructions (prompt injection) or reach other users' data.
- Run the **distress check** on notes and follow-up answers. If triggered, stop the playful pipeline and respond with warmth and support resources; continue only if the user chooses.
- Graphic content renders in an abstract, symbolic style by default.
- Sharing is opt-in, names are stripped by default, links are revocable.
- Free LLM API tiers may use data to improve products. Before any user other than the owner uses the app, default to local models or a provider with no-training terms.

## 7. Workflow rules for the agent

1. **Plan first.** Before writing code, give a short implementation plan and the list of files you will create or change. Wait for approval on large structural decisions.
2. **Read the docs** referenced by the task (`prd.md`, `architecture.md`, `prompts.md`) before coding.
3. **Ask, don't guess,** when a product decision is unclear.
4. **Finish with a report:** files changed, commands to run, a checklist mapping each requirement to its implementation and test, and anything you decided on my behalf.
5. Do not refactor unrelated code. Do not change schemas without updating `/packages/shared` and its tests.
6. Do not install large new dependencies without stating why and what the license is.

## 8. Do-nots

- Do not use text-to-video models.
- Do not generate diagnostic language ("anxiety disorder", "trauma response").
- Do not invent stressors or life context the user did not provide.
- Do not write dream content to logs, analytics, or error trackers.
- Do not skip lip-sync: speaking characters use blendshape visemes driven by the TTS audio. Do not use per-frame AI image or video generation for animation.
- Do not hard-code camera shots or look settings; read them from `config/render.yaml` and `config/styles/*.yaml`.

## 9. Reference projects (port, do not fork)

- **TalkingHead** (met4citizen, MIT): 3D avatar with real-time lip-sync in Three.js. Use as a dependency or port, keeping the license notice.
- **LiveAvatarStream3D** (tech-sumit, MIT): read `apps/avatar-live/src/{capture,timeline,lipsync}` and `packages/{performer-core,protocol}` for frame-exact WebCodecs export and the performance-script idea. Do not fork the whole repo; it is a newscast product with cloud services we do not use.
- Never copy code without checking its license; keep notices in `THIRD-PARTY-NOTICES.md`.