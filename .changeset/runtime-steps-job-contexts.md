---
"run-local-ci": minor
"dtu-github-actions": minor
---

Support the `steps` and `job` contexts (`steps.<id>.outputs.*`, `steps.<id>.outcome` / `conclusion`, `job.status`, `toJSON(steps)`, …) in `run:` scripts, step `env:` and `with:` values. Expressions that read them are no longer expanded to an empty string before the job starts; they are passed to the runner (folded into `format()` like GitHub's parser does) and evaluated while the job runs.
