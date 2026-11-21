import fs from "node:fs";
import type Docker from "dockerode";

const cache = new WeakMap<object, Promise<boolean>>();

/** Whether the Docker API is served by Podman (checked once per client). */
export function isPodmanEngine(docker: Docker): Promise<boolean> {
  let result = cache.get(docker);
  if (!result) {
    result = docker
      .version()
      .then((info: any) => looksLikePodman(info))
      .catch(() => false);
    cache.set(docker, result);
  }
  return result;
}

/** Podman reports a "Podman Engine" component in its version response. */
export function looksLikePodman(info: {
  Components?: { Name?: string }[];
  Platform?: { Name?: string };
}): boolean {
  const names = [info?.Platform?.Name ?? "", ...(info?.Components ?? []).map((c) => c?.Name ?? "")];
  return names.some((n) => /podman/i.test(n));
}

/**
 * Whether this process runs inside a container. Docker creates `/.dockerenv`;
 * Podman creates `/run/.containerenv` instead, so check both (nested Local CI
 * under Podman otherwise behaves as if it ran on the host).
 */
export function isInsideContainer(exists: (p: string) => boolean = fs.existsSync): boolean {
  return exists("/.dockerenv") || exists("/run/.containerenv");
}
