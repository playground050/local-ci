import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describeWorkflow } from "./run.ts";

describe("describeWorkflow", () => {
  let repoRoot: string;

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  function writeWorkflow(content: string): string {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lci-describe-wf-"));
    const dir = path.join(repoRoot, ".github", "workflows");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "ci.yml");
    fs.writeFileSync(file, content);
    return file;
  }

  it("uses the workflow name and the repo-relative file", () => {
    const file = writeWorkflow("name: CI\non: [push]\njobs: {}\n");
    expect(describeWorkflow(file, repoRoot)).toEqual({
      workflowName: "CI",
      workflowFile: ".github/workflows/ci.yml",
    });
  });

  it("falls back to the file path when the workflow has no name, as on GitHub", () => {
    const file = writeWorkflow("on: [push]\njobs: {}\n");
    expect(describeWorkflow(file, repoRoot).workflowName).toBe(".github/workflows/ci.yml");
  });
});
