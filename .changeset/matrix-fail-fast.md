---
"local-ci": patch
"dtu-github-actions": patch
---

Bring `strategy.fail-fast` and `strategy.max-parallel` closer to GitHub: when a matrix leg fails, legs of the same matrix that have not started are cancelled (shown as "cancelled (fail-fast)" in the summary; running legs still finish), and at most `max-parallel` legs run at once. A matrix job's result is now its most severe leg result (a failed leg is no longer hidden by a later successful one), so its dependents are skipped as on GitHub.
