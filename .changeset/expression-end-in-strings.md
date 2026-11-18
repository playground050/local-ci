---
"local-ci": patch
"dtu-github-actions": patch
---

`}}` inside a string literal no longer ends an expression (in the CLI and the DTU), and `format()` treats `{{` and `}}` as literal braces.
