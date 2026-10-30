# prd.md: The Dream Machine

> Product requirements. This file describes **what** and **why**, not technology. Technology lives in `architecture.md`.

## 1. Vision

A dream journal that gets to know you. You wake up with broken fragments; The Dream Machine returns your dream as a whole story, offers gentle ways of understanding it, remembers what your symbols mean *to you*, and turns it into a short animated motion comic.

## 2. Problem

- Dreams fade within minutes and arrive as fragments, not stories.
- Existing dream apps are either plain text journals (no magic) or generic dream dictionaries (impersonal, often wrong).
- People want to *see* and *understand* their dreams, and to notice patterns over time.

## 3. Target user

Primary: the builder and people like them, curious about their inner life, who remember dreams occasionally or often, and enjoy reflective or creative tools. Not a clinical or therapy product.

## 4. The core experience: the recognition moment

> The user reads or watches their dream come back and thinks, "yes, that's it."

Everything in the product serves this moment. Success is when the user accepts the reconstruction with few corrections and feels the animation matches the *feeling* of the dream.

## 5. Core user flow

1. **Capture:** speak or type fragments right after waking. Optional waking mood and recent life context.
2. **Follow-ups:** 2-3 short questions about feeling and sensation, each skippable.
3. **Reconstruct:** the system weaves a full story. Inferred parts are tinted and explain themselves on tap.
4. **Review:** the user corrects any scene ("this isn't how it was"), edits text, switches Faithful / Authored versions, approves.
5. **Reflect:** 2-3 possible threads with quoted evidence. User marks "That resonates" or "That felt different," or skips.
6. **Compose:** a calm progress screen while the dream world and cast are prepared.
7. **Watch:** the live 3D player performs the dream (characters walking, gesturing and speaking, with camera shots) with captions, alongside the story and meaning.
8. **Remember:** the dream joins the journal, graph, lexicon, and weekly "Dream Weather".

## 6. Features

### MVP (the "render spike" plus one full dream)
- Text capture, follow-up questions, reconstruction with flagged inferences, scene-level correction.
- One cel-shaded art style, one rigged character that walks, gestures and speaks (lip-synced), a small procedural dream world, camera shots, narration and ambient audio, all in the browser player.
- Local single-user setup, no accounts needed beyond a local login.

### v1
- Voice capture with transcription.
- Interpretation threads with feedback and per-user symbol lexicon.
- Personal Dream Graph: entities, edges, embeddings, retrieval of past dreams.
- Style bible (cel-shading presets and palettes) and a persistent cast (avatar, outfit and colors per recurring character).
- Journal with semantic search; Cast and Lexicon pages.
- Dream Weather and recurring-motif insights.
- Distress handling and privacy features (export, hard delete).
- Video export (from the browser player).

### Later
- Multi-character scenes, richer world kits, custom avatars (Blender/VRoid).
- Dream episodes (series of related dreams), lucid dreaming nudges, remix of alternate endings.
- Sharing links, vertical cuts, Dream Book PDF.
- Hindi and English capture and narration.
- Fully local mode.

## 7. Functional requirements

| ID | Requirement |
|---|---|
| FR-1 | The user can capture a dream by text or voice; raw audio and a cleaned transcript are kept. |
| FR-2 | The system asks at most 3 follow-up questions, prioritizing emotion and sensation; each is skippable. |
| FR-3 | Reconstruction offers Faithful and Authored modes; every inferred sentence is flagged with a reason. |
| FR-4 | The user can regenerate a single scene with a correction, without changing neighboring scenes' meaning. |
| FR-5 | Interpretation returns 2-3 threads; each quotes the user's own words verbatim; none uses diagnostic language. |
| FR-6 | The user can skip interpretation entirely at any time. |
| FR-7 | Feedback ("resonates" / "felt different" plus optional note) updates the user's symbol meaning distributions. |
| FR-8 | Past dreams influence new reconstructions and interpretations (recurring characters, places, learned meanings). |
| FR-9 | The system detects recurring motifs and emotional trends and shows tentative, dismissible insights. |
| FR-10 | A 30-60 s animated film (5-8 scenes) is produced: a 3D dream world, rigged characters that walk, gesture and speak with lip-sync, camera shots, narration/captions and ambient sound. |
| FR-11 | Art style (cel-shading preset + palette) is locked per user; recurring characters look consistent across dreams. |
| FR-12 | The user can export all data and delete all data permanently. |
| FR-13 | Signs of acute distress pause the playful pipeline and trigger a supportive response. |
| FR-14 | Journal supports filtering by emotion, symbol, character, place, and semantic search. |
| FR-15 | The whole product runs without paid services (see NFR-2). |
| FR-16 | Dream logic is expressible in the world through a fixed vocabulary of effects (flood, float, invert, loop, stretch, duplicate, dissolve) chosen by the director script. |
| FR-17 | The film can be exported as 1080p video from the browser without paid services. |

## 8. Non-functional requirements

- **NFR-1 Privacy:** dream content is encrypted at rest, never logged, never used for training; hard delete is real.
- **NFR-2 Cost:** default configuration uses only free software and free-tier or local models; no credit card required.
- **NFR-3 Performance (on a 16 GB RAM, ~4 GB VRAM laptop):** reconstruction in under ~60 s with a hosted free LLM; world composition in under ~2 minutes; live playback at 30+ fps; video export within roughly 5x the clip length; interactive screens stay responsive.
- **NFR-4 Reliability:** render jobs are resumable per stage; assets are cached by content hash; provider failures fall back automatically.
- **NFR-5 Accessibility:** keyboard navigation, captions on all playback, reduced-motion mode, readable contrast, screen-reader labels.
- **NFR-6 Tone:** gentle, tentative, never clinical.

## 9. Non-goals

- Not a medical, diagnostic, or therapy tool.
- Not a universal dream dictionary.
- Not text-to-video; no uncontrolled generative video.
- Not a social network (sharing is occasional and opt-in).
- Not photoreal: the look is stylized (cel-shaded 3D).

## 10. Success measures (personal project)

- **Recognition rate:** share of reconstructed scenes accepted without correction.
- **Resonance rate:** share of interpretation threads marked "That resonates".
- **Consistency:** the same character recognizably appears across two dreams.
- **Delight:** the builder wants to open it the morning after a vivid dream.
- **Reliability:** at least 9 of 10 renders complete without manual intervention.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Free image quota or quality changes | Images only for skyboxes/textures/backdrops; provider ladder with procedural sky/texture fallback |
| Visual inconsistency between scenes | One asset pack, one toon shader and palette, a shared cast |
| Over-confident or generic interpretation | Evidence quotes validated in code; tentative tone; user can skip |
| Sensitive content | Distress check; abstract rendering default; privacy-first storage |
| Small GPU limits | Sequential GPU jobs, small models, caching, upscaling after generation |
| Scope creep | Build the 3D spike first; ship vertical slices |
| Asset licensing and availability (avatars, animation clips) | Record in THIRD-PARTY-NOTICES.md; fetch restricted assets by script; fall back to primitive puppet |
| Browser GPU load on a small laptop | Low-poly world, one character first, 1080p, degrade effects before frame rate |

## 12. Open questions

- Final art style set (to be defined with `design.md`).
- Free avatar source: Ready Player Me-compatible base, VRoid, or Blender-made (verify current availability).
- Voice and tone of the narrator.
- Whether to support Hindi in v1.
- Hosting plan after local development.

## 13. Acceptance criteria (MVP)

1. From one fragmented dream input, the user gets a reconstructed story with visibly flagged inferences.
2. Correcting one scene regenerates only that scene.
3. Approving the story plays a 30-60 s cel-shaded 3D animation with a walking, speaking character in a dream world with camera shots, runs on the local machine with no paid service, and exports 1080p video from the browser.
4. No dream text appears in any log file.