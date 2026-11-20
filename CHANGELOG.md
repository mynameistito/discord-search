# discord-search

## 0.1.1

### Patch Changes

- 8c388e7: Fix CLI parsing, Discord search and rate-limit handling, and update the project tooling to Ultracite.
- 6e65fe7: Run Discord search, settings, presets, and exports on Effect. Preserve request retry limits and apply the requested upper message ID on the first search page.

  Apply the request timeout to the Discord response body and wait before retrying an indexing response with a zero delay. Preserve case-insensitive environment variable lookup on Windows.

  The Node.js engine requirement now matches the CLI's dependencies at Node 20.12 or later.

- 8f7a980: Update CLI dependencies and CI tooling, and resolve diagnostics from the stricter lint configuration.

## 0.1.0

### Minor Changes

- 610afc7: Add support for `.jsonc` preset files. If a `.jsonc` preset file exists it takes priority over `.json`. Comments (`//` and `/* */`) are stripped before parsing so users can annotate their presets.

### Patch Changes

- e356fee: Replace Bun runtime APIs with Node.js `fs/promises` so the published package runs on Node 18+ without a Bun runtime dependency.

  - `Bun.file`, `Bun.write` replaced with `readFile`, `writeFile`, `access`, and `open` from `node:fs/promises`
  - Settings file now created with `mode: 0o600` — token is never briefly world-readable before the subsequent `chmod`
  - `getPresetsFile` only swallows `ENOENT` on the JSONC probe; permission/IO errors now propagate
  - Gitignore creation uses `open(..., "wx")` with `finally` to guarantee fd closure and eliminate the TOCTOU race
  - `Err` propagation updated across `client.ts` and `search.ts` to satisfy stricter ok-type variance in `better-result` 2.8
  - Dependency bumps: `@clack/prompts`, `better-result`, `biome`, `lefthook`, `tsdown`, `ultracite`, and others
