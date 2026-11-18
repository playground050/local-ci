---
"run-local-ci": patch
---

`toJSON(github)`, `toJSON(needs)` and the other whole-context forms (`runner`, `matrix`, `strategy`, `inputs`, `vars`, `env`, plus paths such as `needs.<job>.outputs`) now produce JSON instead of an empty string. `steps`, `job` and `secrets` are still not serialized.
