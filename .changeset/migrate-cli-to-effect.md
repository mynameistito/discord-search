---
"discord-search": patch
---

Run Discord search, settings, presets, and exports on Effect. Preserve request retry limits and apply the requested upper message ID on the first search page.

Apply the request timeout to the Discord response body and wait before retrying an indexing response with a zero delay. Preserve case-insensitive environment variable lookup on Windows.

The Node.js engine requirement now matches the CLI's dependencies at Node 20.12 or later.
