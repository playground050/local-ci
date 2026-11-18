import { describe, it, expect } from "vitest";
import { createJobResponse } from "./generators.ts";

describe("createJobResponse", () => {
  const basePayload = {
    id: "1",
    name: "test-job",
    githubRepo: "owner/repo",
    steps: [],
  };

  it("propagates job-level env into Variables", () => {
    const payload = {
      ...basePayload,
      env: { LOCAL_CI_LOCAL: "true", MY_VAR: "hello" },
    };

    const response = createJobResponse("1", payload, "http://localhost:3000", "plan-1");
    const body = JSON.parse(response.Body);
    const vars = body.Variables;

    expect(vars.LOCAL_CI_LOCAL).toEqual({ Value: "true", IsSecret: false });
    expect(vars.MY_VAR).toEqual({ Value: "hello", IsSecret: false });
  });

  it("propagates job-level env into ContextData.env", () => {
    const payload = {
      ...basePayload,
      env: { LOCAL_CI_LOCAL: "true" },
    };

    const response = createJobResponse("1", payload, "http://localhost:3000", "plan-1");
    const body = JSON.parse(response.Body);

    // ContextData.env should be a ContextData object with type 2 (mapping)
    expect(body.ContextData.env).toBeDefined();
    expect(body.ContextData.env.t).toBe(2);
    const entries = body.ContextData.env.d;
    const localEntry = entries.find((e: any) => e.k === "LOCAL_CI_LOCAL");
    expect(localEntry).toBeDefined();
    expect(localEntry.v).toEqual({ t: 0, s: "true" });
  });

  it("propagates job-level env into EnvironmentVariables", () => {
    const payload = {
      ...basePayload,
      env: { LOCAL_CI_LOCAL: "true" },
    };

    const response = createJobResponse("1", payload, "http://localhost:3000", "plan-1");
    const body = JSON.parse(response.Body);

    expect(body.EnvironmentVariables).toHaveLength(1);
    const mapping = body.EnvironmentVariables[0];
    expect(mapping.type).toBe(2);
    const entry = mapping.map.find((e: any) => e.Key === "LOCAL_CI_LOCAL");
    expect(entry).toBeDefined();
    expect(entry.Value).toBe("true");
  });

  it("step-level env overrides job-level env on conflict, for that step only", () => {
    const payload = {
      ...basePayload,
      env: { SHARED: "from-job" },
      steps: [
        { name: "step1", run: "echo hi", Env: { SHARED: "from-step", ONLY_STEP1: "1" } },
        { name: "step2", run: "echo hi" },
      ],
    };

    const response = createJobResponse("1", payload, "http://localhost:3000", "plan-1");
    const body = JSON.parse(response.Body);

    // The step carries its own env; the runner layers it over the job env for that step.
    const stepEnv = body.Steps[0].environment.map;
    expect(stepEnv.find((e: any) => e.Key === "SHARED").Value).toBe("from-step");
    expect(body.Steps[1].environment).toBeUndefined();

    // Job-wide Variables / env context keep the job value and never see step-only keys,
    // so step1's env does not leak into step2 (or earlier steps).
    expect(body.Variables.SHARED).toEqual({ Value: "from-job", IsSecret: false });
    expect(body.Variables.ONLY_STEP1).toBeUndefined();
    const entries = body.ContextData.env.d;
    expect(entries.find((e: any) => e.k === "SHARED").v).toEqual({ t: 0, s: "from-job" });
    expect(entries.find((e: any) => e.k === "ONLY_STEP1")).toBeUndefined();
  });

  it("puts the GITHUB_* source keys into the github context", () => {
    const payload = {
      ...basePayload,
      githubRepo: "acme/widgets",
      repository: { full_name: "acme/widgets", name: "widgets", owner: { login: "acme" } },
      workflowName: "CI",
      workflowFile: ".github/workflows/ci.yml",
    };
    const body = JSON.parse(
      createJobResponse("1", payload, "http://localhost:3000", "plan-1").Body,
    );
    const github = Object.fromEntries(
      body.ContextData.github.d.filter((e: any) => e.v?.t === 0).map((e: any) => [e.k, e.v.s]),
    );
    expect(github).toMatchObject({
      ref_name: "main",
      ref_type: "branch",
      ref_protected: "false",
      base_ref: "",
      head_ref: "",
      repository_owner: "acme",
      triggering_actor: "acme",
      workflow: "CI",
      workflow_ref: "acme/widgets/.github/workflows/ci.yml@refs/heads/main",
    });
    expect(body.Variables.GITHUB_WORKFLOW).toEqual({ Value: "CI", IsSecret: false });
  });

  it("includes default_branch in event.repository (issue #241)", () => {
    const payload = {
      ...basePayload,
      repository: {
        full_name: "owner/repo",
        name: "repo",
        owner: { login: "owner" },
        default_branch: "develop",
      },
    };

    const response = createJobResponse("1", payload, "http://localhost:3000", "plan-1");
    const body = JSON.parse(response.Body);
    const github = body.ContextData.github;

    function findKey(node: any, key: string): any {
      if (node?.t === 2 && Array.isArray(node.d)) {
        const entry = node.d.find((e: any) => e.k === key);
        return entry?.v;
      }
      return undefined;
    }

    const event = findKey(github, "event");
    const repo = findKey(event, "repository");
    const defaultBranch = findKey(repo, "default_branch");

    expect(defaultBranch).toBeDefined();
    expect(defaultBranch).toEqual({ t: 0, s: "develop" });
  });

  it("omits env from ContextData when no env is provided", () => {
    const response = createJobResponse("1", basePayload, "http://localhost:3000", "plan-1");
    const body = JSON.parse(response.Body);

    expect(body.ContextData.env).toBeUndefined();
    expect(body.EnvironmentVariables).toEqual([]);
  });

  it("defaults to Linux runner layout when runnerOs is not set", () => {
    const response = createJobResponse("1", basePayload, "http://localhost:3000", "plan-1");
    const body = JSON.parse(response.Body);
    const vars = body.Variables;

    expect(vars.RUNNER_OS.Value).toBe("Linux");
    expect(vars.RUNNER_ARCH.Value).toBe("X64");
    expect(vars.RUNNER_TEMP.Value).toBe("/tmp/runner");
    expect(vars.RUNNER_TOOL_CACHE.Value).toBe("/opt/hostedtoolcache");
    expect(vars.GITHUB_WORKSPACE.Value).toBe("/home/runner/_work/repo/repo");
    expect(body.Workspace.Path).toBe("/home/runner/_work/repo/repo");
  });

  it("uses macOS runner layout when runnerOs is macOS", () => {
    const payload = { ...basePayload, runnerOs: "macOS" as const };
    const response = createJobResponse("1", payload, "http://localhost:3000", "plan-1");
    const body = JSON.parse(response.Body);
    const vars = body.Variables;

    expect(vars.RUNNER_OS.Value).toBe("macOS");
    expect(vars.RUNNER_ARCH.Value).toBe("ARM64");
    expect(vars.RUNNER_TEMP.Value).toBe("/Users/admin/local-ci-runner/_work/_temp");
    expect(vars.RUNNER_TOOL_CACHE.Value).toBe("/Users/admin/hostedtoolcache");
    expect(vars.GITHUB_WORKSPACE.Value).toBe("/Users/admin/local-ci-runner/_work/repo/repo");
    expect(body.Workspace.Path).toBe("/Users/admin/local-ci-runner/_work/repo/repo");
  });

  it("honors explicit runnerArch override on macOS", () => {
    const payload = { ...basePayload, runnerOs: "macOS" as const, runnerArch: "X64" as const };
    const response = createJobResponse("1", payload, "http://localhost:3000", "plan-1");
    const body = JSON.parse(response.Body);

    expect(body.Variables.RUNNER_ARCH.Value).toBe("X64");
  });

  it("honors explicit runnerWorkDir override", () => {
    const payload = {
      ...basePayload,
      runnerOs: "macOS" as const,
      runnerWorkDir: "/opt/custom/_work",
    };
    const response = createJobResponse("1", payload, "http://localhost:3000", "plan-1");
    const body = JSON.parse(response.Body);
    const vars = body.Variables;

    expect(vars.RUNNER_TEMP.Value).toBe("/opt/custom/_work/_temp");
    expect(vars.GITHUB_WORKSPACE.Value).toBe("/opt/custom/_work/repo/repo");
    expect(body.Workspace.Path).toBe("/opt/custom/_work/repo/repo");
  });
});

describe("createJobResponse — continue-on-error", () => {
  const step = (extra: Record<string, unknown>) => ({
    Name: "s",
    Reference: { Type: "Script" },
    Inputs: { script: "exit 3" },
    ...extra,
  });

  it("passes continueOnError to the runner only for continue-on-error steps", () => {
    const payload = {
      id: "1",
      name: "test-job",
      githubRepo: "owner/repo",
      steps: [step({ continueOnError: true }), step({})],
    };
    const body = JSON.parse(
      createJobResponse("1", payload, "http://localhost:3000", "plan-1").Body,
    );
    expect(body.Steps[0].continueOnError).toBe(true);
    expect(body.Steps[1]).not.toHaveProperty("continueOnError");
  });
});
