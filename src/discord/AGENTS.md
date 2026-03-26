OVERVIEW
Discord API integration layer with rate limiting, dual pagination, and Zod validation.

WHERE TO LOOK
- Rate limit state: client.ts:13-52
- Snowflake pagination: search.ts:190-240
- HTTP 202 handler: client.ts:114-161
- Zod schemas: schemas.ts (all)
- Query builder: search.ts:50-120
- Retry logic: client.ts:170-210

CONVENTIONS
All functions return Result types (never throw)
Validate every API response with Zod before processing
Proactive rate limiting: parse X-RateLimit-Reset headers
Reactive 429 handling: exponential backoff with jitter
Max 5 retries for HTTP 202 (index not ready)
Offset pagination: 0-9975 (25 results per page, max 400 pages)
Snowflake pagination: partition by snowflake for results >10K
Progress callbacks receive SearchProgress during operations
Use inferred types from Zod schemas (SearchResponse, Message, etc.)
Snowflake parsing requires BigInt (can't fit in Number)
Extract constants: MAX_OFFSET=9975, MAX_RETRIES=5, BASE_DELAY_MS
Rate limit state persists across requests (mutable ref)

ANTI-PATTERNS
Throwing errors instead of returning Result types
Bypassing or ignoring rate limit checks
Magic numbers scattered in code (extract to constants)
Skipping Zod validation of API responses
Using await without capturing return value
Using Number for snowflakes (must use BigInt)
Hardcoding retry delays (use exponential backoff)
