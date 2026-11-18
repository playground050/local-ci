---
"local-ci": patch
"dtu-github-actions": patch
---

`hashFiles` uses the runner's algorithm (SHA-256 over each file's SHA-256) and returns an empty string when nothing matches.
