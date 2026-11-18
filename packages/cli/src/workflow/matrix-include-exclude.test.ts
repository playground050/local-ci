import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collapseMatrixToSingle,
  expandExpressions,
  expandMatrixCombinations,
  parseStrategySettings,
} from "./workflow-parser.ts";

describe("expandMatrixCombinations — include / exclude", () => {
  it("expands include like GitHub's documented example", () => {
    // https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#example-expanding-configurations
    const combos = expandMatrixCombinations({
      fruit: ["apple", "pear"],
      animal: ["cat", "dog"],
      include: [
        { color: "green" },
        { color: "pink", animal: "cat" },
        { fruit: "apple", shape: "circle" },
        { fruit: "banana" },
        { fruit: "banana", animal: "cat" },
      ],
    });
    expect(combos).toEqual([
      { fruit: "apple", animal: "cat", color: "pink", shape: "circle" },
      { fruit: "apple", animal: "dog", color: "green", shape: "circle" },
      { fruit: "pear", animal: "cat", color: "pink" },
      { fruit: "pear", animal: "dog", color: "green" },
      { fruit: "banana" },
      { fruit: "banana", animal: "cat" },
    ]);
  });

  it("removes partially matching exclude entries", () => {
    const combos = expandMatrixCombinations({
      os: ["macos-latest", "windows-latest"],
      version: [12, 14, 16],
      environment: ["staging", "production"],
      exclude: [
        { os: "macos-latest", version: 12, environment: "production" },
        { os: "windows-latest", version: 16 },
      ],
    });
    expect(combos).toHaveLength(9);
    expect(combos).not.toContainEqual({
      os: "macos-latest",
      version: "12",
      environment: "production",
    });
    expect(combos.filter((c) => c.os === "windows-latest" && c.version === "16")).toEqual([]);
  });

  it("applies exclude before include, matching the parity probe", () => {
    const combos = expandMatrixCombinations({
      size: ["small", "large"],
      mode: ["fast", "slow"],
      exclude: [{ size: "large", mode: "slow" }],
      include: [
        { size: "small", mode: "fast", extra: "added-by-include" },
        { size: "huge", mode: "fast" },
      ],
    });
    expect(combos).toEqual([
      { size: "small", mode: "fast", extra: "added-by-include" },
      { size: "small", mode: "slow" },
      { size: "large", mode: "fast" },
      { size: "huge", mode: "fast" },
    ]);
  });

  it("builds the matrix from include alone", () => {
    expect(
      expandMatrixCombinations({
        include: [
          { site: "production", datacenter: "site-a" },
          { site: "staging", datacenter: "site-b" },
        ],
      }),
    ).toEqual([
      { site: "production", datacenter: "site-a" },
      { site: "staging", datacenter: "site-b" },
    ]);
  });

  it("keeps object values as JSON instead of [object Object]", () => {
    expect(expandMatrixCombinations({ node: [{ version: 24, lts: true }] })).toEqual([
      { node: '{"version":24,"lts":true}' },
    ]);
  });

  it("never treats include / exclude as matrix axes", () => {
    const combos = expandMatrixCombinations({
      a: [1, 2],
      include: [{ a: 1, b: "x" }],
      exclude: [{ a: 2 }],
    });
    expect(combos).toEqual([{ a: "1", b: "x" }]);
  });

  it("--no-matrix collapses to the first real combination", () => {
    expect(
      collapseMatrixToSingle({
        a: [1, 2],
        include: [{ a: 1, b: "x" }],
      }),
    ).toEqual([{ a: "1", b: "x", __job_total: "1", __job_index: "0" }]);
  });
});

describe("strategy context", () => {
  let dir: string;

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reads fail-fast and max-parallel with GitHub's defaults", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "lci-strategy-"));
    const file = path.join(dir, "wf.yml");
    fs.writeFileSync(
      file,
      `
on: [push]
jobs:
  defaults:
    strategy: { matrix: { a: [1, 2, 3] } }
  custom:
    strategy: { fail-fast: false, max-parallel: 2, matrix: { a: [1, 2, 3] } }
`,
    );
    expect(parseStrategySettings(file, "defaults", 3)).toEqual({ failFast: true, maxParallel: 3 });
    expect(parseStrategySettings(file, "custom", 3)).toEqual({ failFast: false, maxParallel: 2 });
  });

  it("exposes strategy.fail-fast and strategy.max-parallel in expressions", () => {
    const matrix = { __fail_fast: "false", __max_parallel: "2", __job_total: "3" };
    expect(expandExpressions("${{ strategy.fail-fast }}", undefined, undefined, matrix)).toBe(
      "false",
    );
    expect(expandExpressions("${{ strategy.max-parallel }}", undefined, undefined, matrix)).toBe(
      "2",
    );
  });
});
