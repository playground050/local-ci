---
"local-ci": patch
"dtu-github-actions": patch
---

The runner's `github.run_id`, `run_number` and `run_attempt` match the static values Local CI uses, so keys such as `cache-${{ github.run_id }}` agree on both sides.
