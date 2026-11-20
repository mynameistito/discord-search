# Discord API

- `client.ts` owns authenticated HTTP, per-guild and per-token rate-limit state, and bounded retries for HTTP 202 and 429. The CLI shares one client Layer across searches.
- `search.ts` validates filters, builds queries, and paginates by offset through 9975 before continuing with a snowflake bound. Keep snowflakes as strings.
- `schemas.ts` defines the request and response schemas. Decode responses before passing them to the application.
- `search.test.ts` provides the client Layer with a deterministic HTTP adapter and uses the Effect TestClock for retry tests.
