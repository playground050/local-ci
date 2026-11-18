import fs from "node:fs";
import { parse as parseYaml } from "yaml";

/**
 * Parse job `needs:` dependencies from raw workflow YAML.
 * Returns a Map<jobId, string[]> of upstream job IDs each job depends on.
 */
export function parseJobDependencies(workflowPath: string): Map<string, string[]> {
  const deps = new Map<string, string[]>();
  try {
    const yaml = parseYaml(fs.readFileSync(workflowPath, "utf-8"));
    const jobs = yaml?.jobs ?? {};
    for (const [jobId, jobDef] of Object.entries<any>(jobs)) {
      const needs = jobDef?.needs;
      if (!needs) {
        deps.set(jobId, []);
      } else if (typeof needs === "string") {
        deps.set(jobId, [needs]);
      } else if (Array.isArray(needs)) {
        deps.set(jobId, needs.map(String));
      } else {
        deps.set(jobId, []);
      }
    }
  } catch {
    // Can't parse — return empty deps
  }
  return deps;
}

/**
 * Topological sort of job IDs by their dependencies.
 * Returns an array of waves; each wave is a set of job IDs that can run in parallel.
 * Falls back to a single wave containing all remaining jobs if a cycle is detected.
 */
export function topoSort(deps: Map<string, string[]>): string[][] {
  const waves: string[][] = [];
  const remaining = new Map(deps);
  const completed = new Set<string>();

  while (remaining.size > 0) {
    // Find jobs whose all dependencies are already completed
    const wave: string[] = [];
    for (const [jobId, needs] of remaining) {
      if (needs.every((n) => completed.has(n))) {
        wave.push(jobId);
      }
    }
    if (wave.length === 0) {
      // Cycle detected or unresolvable dependency — run remaining in one wave
      waves.push(Array.from(remaining.keys()));
      break;
    }
    for (const jobId of wave) {
      remaining.delete(jobId);
      completed.add(jobId);
    }
    waves.push(wave);
  }
  return waves;
}

/**
 * Results of every job `jobId` transitively depends on, for evaluating its
 * `if:` status functions. GitHub's `success()` / `failure()` look at all
 * ancestor jobs, so a job two hops below a failure is skipped by default and
 * still runs under `if: failure()` or `if: always()`.
 */
export function collectAncestorResults(
  jobId: string,
  deps: Map<string, string[]>,
  results: Map<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const stack = [...(deps.get(jobId) ?? [])];
  while (stack.length > 0) {
    const dep = stack.pop()!;
    if (dep in out) {
      continue;
    }
    out[dep] = results.get(dep) ?? "success";
    stack.push(...(deps.get(dep) ?? []));
  }
  return out;
}
