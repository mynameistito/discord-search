# Handlers

OVERVIEW: Business logic orchestration layer bridging CLI prompts to core services

WHERE TO LOOK
Search execution: search.ts:executeSearch()
Preset workflow: presets.ts:resolveSearchParams()
Export orchestration: export.ts:handleExport()
Settings UI: settings.ts:handleSettings()

CONVENTIONS
Use @clack/prompts with handleCancel wrapper
Spinner UI for async operations
Progress callbacks during long operations
matchError for exhaustive error handling
Each handler maps to one menu action or user feature
Coordinate discord API → collate → export → file pipeline
Return early on user cancellation

ANTI-PATTERNS
Don't add business logic in handlers
Never bypass error handling
Don't call discord directly from CLI
Don't mix UI and business logic
Don't duplicate validation from services
