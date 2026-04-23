---
"discord-search": patch
---

Replace Bun runtime APIs with Node.js `fs/promises` equivalents. `Bun.file`, `Bun.write` replaced with `readFile`, `writeFile`, and `access` so the published package runs on Node 18+.
