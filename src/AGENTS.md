# Source Code: Core Application Logic

## OVERVIEW
CLI application for Discord message search with config management, preset CRUD, and export functionality.

## WHERE TO LOOK
- **Types**: types.ts - AppState type definition
- **Config**: config.ts:loadConfig() - Settings persistence, env vars, invite link generation
- **Errors**: errors.ts - TaggedError classes (ConfigError, DiscordApiError, RateLimitExhaustedError)
- **Collation**: collate.ts:collateResults() - Message aggregation, embed extraction, stats
- **Export**: export.ts - exportJson(), exportMessagesCsv() - JSON/CSV output
- **Presets**: presets.ts - loadPresets(), savePreset(), deletePreset()
- **Entry Point**: index.ts - Main CLI loop, interactive menu system
- **File System**: paths.ts - Directory creation, path resolution

## CONVENTIONS
- Use `type` keyword exclusively, never `interface`
- Error handling via TaggedError pattern with descriptive error tags
- All async operations use `async/await` with proper error propagation
- File I/O operations go through paths.ts for consistent path handling
- State management through config.ts:loadConfig()/saveConfig()

## ANTI-PATTERNS
- Never use `any`, prefer `unknown` for untyped data
- Don't modify global rate limit state directly, use Discord client
- Avoid spread operators in loop accumulators (violates Ultracite performance rules)
- Don't bypass config.ts for env var resolution
- Never throw strings, always use TaggedError instances
