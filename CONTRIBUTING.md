# Contributing

Thanks for taking the time to contribute!

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.0.0 **or** Node.js ≥ 18.0.0
- A Discord bot token (for running the tool locally — see the [README](README.md) for setup)

## Setup

```sh
git clone https://github.com/mynameistito/discord-search.git
cd discord-search
bun install
```

Pre-commit hooks are managed by [Lefthook](https://github.com/evilmartians/lefthook) and run automatically on commit. They run in parallel:

- **Lint & format** (`ultracite fix`) — auto-fixes JS/TS/JSON/CSS files
- **Type check** (`tsgo --noEmit`) — TypeScript validation on changed `.ts` files
- **YAML validation** (`v8r`) — validates `.yml`/`.yaml` files
- **Cleanup script** — runs `scripts/cleanup.ts` on every commit

If a hook fails, fix the reported issue before re-committing. Do **not** use `--no-verify` to bypass hooks.

## Project Structure

```
index.ts              # Entry point — CLI main loop, arg parsing, interactive menus, message browser

src/
  collate.ts          # Aggregates messages into analytics (by author, channel, embed stats)
  config.ts           # Loads env config, saves .env file, generates bot invite links
  errors.ts           # Tagged error types (ConfigError, DiscordApiError, …)
  export.ts           # Export functions: JSON, messages CSV, embeds CSV, fields CSV
  presets.ts           # Load/save/delete search presets from .discord-search-presets.json
  discord/
    client.ts         # HTTP client for Discord API with rate limit handling
    schemas.ts        # Zod schemas for Discord API response types
    search.ts         # Search logic: parameter building, pagination, snowflake partitioning

__tests__/            # Test directory

scripts/
  cleanup.ts          # Pre-commit cleanup hook

 .github/workflows/
   ci.yml              # Typecheck → lint → build → test (Bun latest/canary)
   release.yml         # Changesets-based npm publish
```

## Development

```sh
bun test          # run full test suite with Bun
bun run typecheck # type-check with tsgo
bun run check     # lint with Biome/Ultracite (report only)
bun run fix       # lint + auto-fix
bun run build     # build to dist/
```

### Configuration

The tool reads configuration from a `.env` file in the project root (or via environment variables):

- `DISCORD_BOT_TOKEN` — bot token from the Discord Developer Portal
- `DISCORD_GUILD_ID` — default server/guild ID (optional)
- `DISCORD_CLIENT_ID` — application client ID for invite link generation (optional)

Search presets are stored in `.discord-search-presets.json`.

See `.env.example` for the expected shape.

## Coding Conventions

- **ESM only** — all files use `import`/`export`; no `require()`.
- **Result types** — use `better-result` tagged errors instead of thrown exceptions. Add new error tags to `src/errors.ts`.
- **No external runtime deps** unless strictly necessary. The runtime dependencies are `@clack/prompts`, `better-result`, and `zod`.
- **Formatting/linting** is enforced by Biome via Ultracite. Run `bun run fix` to auto-fix before committing.

## Testing

When adding a feature or fixing a bug, include tests in `__tests__/`.

Run the test suite before opening a PR:

```sh
bun test
```

## Submitting a PR

**Every PR must be linked to an open issue.** If one doesn't exist yet, open it first and wait for a brief acknowledgement before investing time in an implementation. This keeps effort aligned and avoids duplicate or unwanted work.

1. Open or find the relevant issue.
2. Fork the repo and create a branch from `main`.
3. Make your changes and ensure tests pass.
4. Add a changeset describing your change:
   ```sh
   bunx changeset
   ```
   Choose the correct bump type:
   - `patch` — bug fixes, documentation, internal refactors with no behavior change
   - `minor` — new search filters, new export formats, backwards-compatible features
   - `major` — breaking changes to the CLI interface or config format
5. Open a pull request against `main` and reference the issue (`Closes #123`) in the PR description.

> PRs without a changeset will not be merged unless they are non-user-facing (e.g. CI config, internal refactors with no behavior change).

### PR checklist

- [ ] Linked to an open issue
- [ ] Tests added or updated
- [ ] `bun test` passes
- [ ] `bun run typecheck` passes
- [ ] Changeset added (if user-facing)
- [ ] PR description explains *what* and *why*, not just *what*

## AI-Assisted Contributions

AI-assisted contributions are welcome. However:

- **Do not paste raw AI output** into PR descriptions or issue reports.
- Descriptions must be **accurate, concise, and human-reviewed**.
- Sloppy or generic AI-generated descriptions will be sent back for revision.

## Commit Style

Use short, imperative commit messages (e.g. `fix: handle missing config file`). Prefix with a type: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.

## CI

CI runs on every push and PR to `main`:

1. **check** — typecheck + lint
2. **build** — build verification + `npm pack --dry-run`
3. **test-bun** — `bun test` on Bun latest and canary (canary failures are non-blocking)

All jobs must pass for a PR to be mergeable.

## Release Process

Releases are automated via [Changesets](https://github.com/changesets/changesets) and the `release.yml` workflow:

1. Merging changesets to `main` triggers a "Version Packages" PR.
2. Merging that PR publishes to npm with provenance and creates a GitHub release.

You do not need to manually version or publish anything.
