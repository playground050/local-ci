# Podman (macOS)

Local CI runs on a Podman machine as well as on Docker providers. This fork's full self-test (`pnpm local-ci-dev run --all`) passes on Podman 6.2 with the Apple Virtualization provider (applehv) on macOS 27; the one expected failure is the linux-x64 cross-compile in `native-binaries`, which cannot link on an arm64 host. Upstream Local CI only targets Docker providers.

## Setup

1. Install Podman and Rosetta.

   ```sh
   brew install podman
   softwareupdate --install-rosetta --agree-to-license
   ```

2. Use the Apple Virtualization provider with Rosetta. Podman 6 defaults to libkrun on macOS, which cannot use Rosetta and runs `linux/amd64` images under QEMU (3–17× slower than native). Add to `~/.config/containers/containers.conf`:

   ```toml
   [machine]
   provider = "applehv"
   rosetta = true
   ```

3. Create the machine, sharing only the folder your repositories live in (here `~/work`):

   ```sh
   podman machine init --volume "$HOME/work:$HOME/work"
   podman machine start
   ```

   Without `--volume`, a Podman machine shares `/Users` (every user's home), `/private` and `/var/folders` with the VM. See [Why share only one folder](#why-share-only-one-folder).

4. Put Local CI's working directory inside that folder. On macOS it defaults to the system temp folder under `/var/folders`, which the machine no longer shares, so bind mounts would fail. In your shell profile:

   ```sh
   export LOCAL_CI_WORKING_DIR="$HOME/work/.local-ci"
   ```

   `LOCAL_CI_WORKING_DIR` can also go in a repository's `.env.local-ci`, but then it applies to that repository only.

5. Create `/var/run/docker.sock`, the path Local CI mounts into every runner (see [Docker socket setup](./docker-socket.md)), and restart the machine:

   ```sh
   sudo "$(brew --prefix podman)/bin/podman-mac-helper" install
   podman machine stop
   podman machine start
   ```

6. Check the setup. `VM TYPE` should be `applehv`, `"Rosetta": true` should appear, and the only shared folder should be `~/work` (`/var/mnt` is Rosetta's own mount):

   ```sh
   podman machine list
   podman machine inspect | grep -i rosetta
   podman machine ssh "mount -t virtiofs"
   ls -l /var/run/docker.sock
   ```

Recreating a machine (`podman machine rm`) deletes its images; the `containers.conf` settings are kept.

## What Local CI does differently on Podman

When the engine is Podman (detected from the engine's version information), Local CI:

- **Keeps the runner's temp directory in a tmpfs** (`/home/runner/_work/_temp`). The machine shares host folders over virtiofs, where GNU tar cannot open the mode-000 placeholder it writes for some symlinks, so actions such as `actions/setup-node` failed to extract their downloads.
- **Builds a custom runner image** (`.github/local-ci.Dockerfile`) through Podman's API instead of the `docker` CLI, whose buildx builder never loaded the result into Podman's image store.
- **Starts job containers with `label=disable`.** The Podman machine runs SELinux, which denies a container (`container_t`) a connection to the Podman service (`container_runtime_t`), so steps that use the mounted socket — `docker build`, nested Local CI — failed with `connect EACCES /var/run/docker.sock`.

It also recognises Podman containers by `/run/.containerenv` (Docker uses `/.dockerenv`) when Local CI itself runs inside a container.

## Why share only one folder

Every job gets the Podman API socket, as every job gets the Docker socket under Docker. A job that can reach the socket can start a privileged container, so it can do anything in the Podman machine as root, including reading and writing every folder the machine shares from the Mac. With the default shares that is your whole home folder (source code, `~/.ssh`, cloud credentials) and your temp folder; a write to `~/.zshrc` or `~/Library/LaunchAgents/` would run on the Mac the next time you open a shell or log in. Shared files are accessed with your own Mac user's permissions, so files you cannot write stay out of reach either way.

Sharing only `~/work` limits that to your repositories. It applies whatever the SELinux setting.

`label=disable` is used instead of a custom SELinux type for the same reason: a custom type (`container_t` plus permission to connect to the socket) would keep file-access confinement and MCS separation, but a job with the socket can start a privileged container anyway, and the policy module would have to be loaded into every machine.
