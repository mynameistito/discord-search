# Discord Search CLI

**Generated:** 2025-03-26
**Commit:** 7db4749
**Branch:** feat/init

## OVERVIEW
TypeScript CLI tool for Discord message search with filtering, presets, and export. Built with Bun runtime, Zod validation, better-result error handling, and @clack/prompts for interactive UI.

## STRUCTURE
```text
src/
├── cli/           # CLI UI (args, prompts, browser, keys, ansi)
├── handlers/        # Business logic (search, presets, settings, export)
├── discord/         # API client, search, Zod schemas
├── index.ts         # Entry point with menu loop
├── types.ts         # AppState type
├── config.ts        # Settings loader
├── paths.ts         # File path utilities
├── errors.ts        # Tagged errors (better-result)
├── collate.ts       # Data aggregation
├── export.ts        # JSON/CSV export
└── presets.ts       # Preset persistence
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| CLI flow | src/index.ts | Main menu loop |
| Search logic | src/handlers/search.ts | Execution orchestration |
| API integration | src/discord/client.ts | Rate limiting, retries |
| Schemas | src/discord/schemas.ts | Zod validation |
| Error handling | src/errors.ts | Tagged union |

## CONVENTIONS
- Railway-oriented programming with better-result
- Tagged errors for discriminated unions
- Schema-first with Zod for API contracts
- Use `type` keyword over `interface`

## ANTI-PATTERNS
- Using `interface` instead of `type`
- Unawaited promises in async functions
- Async functions as Promise executors
- Throwing strings instead of Error objects

## COMMANDS
```bash
bun run build        # Compile with tsdown
bun run dev          # Watch mode
bun run check        # Ultracite lint
bun run fix          # Auto-fix issues
bun run typecheck   # TypeScript validation
```

## NOTES
- Bin command: `discord-search`
- Snowflake-based pagination for large datasets
- Rate limiting with exponential backoff
- 12+ message filter types supported

---

## Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards.

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Diagnose setup**: `bun x ultracite doctor`

Most formatting and common issues are automatically fixed. Run `bun x ultracite fix` before committing.

---

## Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details.

See `opensrc/sources.json` for the list of available packages and their versions.

Use this source code when you need to understand how a package works internally, not just its types/interface.

### Fetching Additional Source Code

To fetch source code for a package or repository you need to understand, run:

```bash
npx opensrc <package>           # npm package (e.g., npx opensrc zod)
npx opensrc pypi:<package>      # Python package (e.g., npx opensrc pypi:requests)
npx opensrc crates:<package>    # Rust crate (e.g., npx opensrc crates:serde)
npx opensrc <owner>/<repo>      # GitHub repo (e.g., npx opensrc vercel/ai)
```
