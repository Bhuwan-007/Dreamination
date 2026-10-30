# THIRD-PARTY-NOTICES.md: Third-Party Assets and Licenses

The Dream Machine uses open-source and permissively licensed libraries, tools, and assets.
Assets whose license terms forbid redistribution in git repositories are downloaded on-demand via scripts in `/scripts` and are strictly excluded by `.gitignore`.

---

## 1. 3D & Graphics Libraries

### Three.js
* **License:** MIT
* **Author:** Ricardo Cabello (mrdoob) and Three.js authors
* **Repository:** https://github.com/mrdoob/three.js
* **Notice:**
```
The MIT License
Copyright © 2010-2024 three.js authors
Permission is hereby granted, free of charge, to any person obtaining a copy of this software...
```

### mp4-muxer
* **License:** MIT
* **Author:** Kieran Simpson
* **Repository:** https://github.com/Vanilagy/mp4-muxer
* **Notice:**
```
MIT License
Copyright (c) 2023 Kieran Simpson
Permission is hereby granted, free of charge, to any person obtaining a copy...
```

---

## 2. Avatar & Lip-Sync Modules

### TalkingHead
* **License:** MIT
* **Author:** met4citizen
* **Repository:** https://github.com/met4citizen/TalkingHead
* **Notice:**
```
MIT License
Copyright (c) 2023 met4citizen
Permission is hereby granted, free of charge, to any person obtaining a copy...
```

### PrimitivePuppet (Fallback)
* **Author:** The Dream Machine Project
* **License:** MIT
* **Description:** Procedural stylized capsule puppet with procedural walk bob, eye mask, and mouth flap viseme driver. Embedded directly in `/packages/dream-player` for zero-dependency local execution.

---

## 3. External Models & Animation Clips (Fetched On-Demand)

* **Ready Player Me Compatible Avatars:**
  * Fetched on demand via `scripts/fetch-avatars.ps1` or `scripts/fetch-avatars.sh`.
  * Excluded from Git tracking via `.gitignore`.
  * Usage: Non-commercial evaluation and personal dream playback.

* **Mixamo Motion Clips:**
  * Walk, Idle, Look Around, and Reach FBX/glTF clips converted for web playback.
  * Fetched on demand via `scripts/fetch-animations.ps1` or `scripts/fetch-animations.sh`.
  * Excluded from Git tracking via `.gitignore`.

---

## 4. Audio & Fonts

* **Web Audio Synthesis:**
  * All ambient beds, wind noise, and ticking motifs are synthesized dynamically via the Web Audio API without pre-recorded audio files.
* **Google Fonts (Fraunces, Newsreader, Instrument Sans):**
  * **License:** SIL Open Font License (OFL) 1.1.

