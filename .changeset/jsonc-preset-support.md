---
"discord-search": minor
---

Add JSONC support for preset files. The CLI now reads `.discord-search-presets.jsonc` (with comment support) when present, falling back to `.discord-search-presets.json`. Saves and deletes write back to whichever file was found, defaulting to `.json`.
