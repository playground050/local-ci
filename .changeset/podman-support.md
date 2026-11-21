---
"local-ci": patch
"dtu-github-actions": patch
---

Run on Podman (tested with Podman machine on macOS):

- Finish runs when the job ends: close the log reader when the runner container exits, because Podman keeps the follow log stream open (#403).
- Detect running inside a container under Podman too (`/run/.containerenv`, not only `/.dockerenv`) in the CLI, the DTU, the native CLI and the `repro-378.sh` smoke script. Nested Local CI previously treated itself as running on the host and hung.
- Keep the runner's temp directory (`/home/runner/_work/_temp`) in a tmpfs. The Podman machine shares host folders over virtiofs, where GNU tar cannot open the mode-000 placeholder it writes for some symlinks (`actions/setup-node` failed with `tar: bin/npm: Cannot open: Permission denied`).
- Build a custom runner image (`.github/local-ci.Dockerfile`) through Podman's API instead of the `docker` CLI, whose buildx builder left the result outside Podman's image store ("no such image: docker.io/library/local-ci-runner:…").
- Start job containers with `label=disable`: SELinux in the Podman machine otherwise denies steps the mounted API socket (`connect EACCES /var/run/docker.sock` for nested `docker` / `local-ci`).
