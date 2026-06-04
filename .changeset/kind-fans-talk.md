---
"discord-search": patch
---

Security remediation: removed compromised repository setup hooks that could execute node .github/setup.js from editor/agent configuration and the package test script. The malicious setup payload has been deleted.
