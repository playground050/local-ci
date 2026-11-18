import { describe, expect, it } from "vitest";
import { callsStatusFunction, evaluateExpression } from "./expression.ts";
import { evaluateJobIf, jobIfContexts } from "./workflow-parser.ts";

const ev = (expr: string, contexts: Record<string, unknown> = {}) =>
  evaluateExpression(expr, { contexts });

describe("evaluateExpression", () => {
  it("coerces mismatched types to numbers for ==, as GitHub does", () => {
    expect(ev("true == 1")).toBe(true);
    expect(ev("'1' == 1")).toBe(true);
    expect(ev("null == 0")).toBe(true);
    expect(ev("'' == 0")).toBe(true);
    expect(ev("'abc' == 0")).toBe(false);
  });

  it("compares strings case-insensitively", () => {
    expect(ev("'ABC' == 'abc'")).toBe(true);
    expect(ev("'a' < 'B'")).toBe(true);
  });

  it("reads negative numbers", () => {
    expect(ev("-1 == -1")).toBe(true);
    expect(ev("fromJSON('{\"n\":-2}').n < -1")).toBe(true);
    expect(() => ev("1 - 1")).toThrow();
  });

  it("reads hex and exponent numbers", () => {
    expect(ev("0xff == 255")).toBe(true);
    expect(ev("1.5e1")).toBe(15);
  });

  it("indexes arrays and objects, and filters with .*", () => {
    expect(ev("fromJSON('[10,20]')[1]")).toBe(20);
    expect(ev("fromJSON('{\"k\":null}').k == null")).toBe(true);
    expect(ev('fromJSON(\'[{"n":1},{"n":2},{"m":3}]\').*.n')).toEqual([1, 2]);
    expect(ev('contains(fromJSON(\'[{"n":1},{"n":2}]\').*.n, 2)')).toBe(true);
    expect(ev("github.EVENT_NAME", { github: { event_name: "push" } })).toBe("push");
  });

  it("returns operands from && and ||", () => {
    expect(ev("'' || 'fallback'")).toBe("fallback");
    expect(ev("'x' && 'y'")).toBe("y");
    expect(ev("!0")).toBe(true);
  });

  it("formats with escaped braces and joins", () => {
    expect(ev("format('{0}-{{x}}', 'a')")).toBe("a-{x}");
    expect(ev("join(fromJSON('[\"a\",\"b\"]'), '+')")).toBe("a+b");
  });

  it("finds status function calls outside string literals", () => {
    expect(callsStatusFunction("always() && x")).toBe(true);
    expect(callsStatusFunction("'always()' == x")).toBe(false);
  });
});

describe("evaluateJobIf", () => {
  it("evaluates typed comparisons and contexts", () => {
    expect(evaluateJobIf("true == 1", {})).toBe(true);
    expect(evaluateJobIf("${{ 'ABC' == 'abc' }}", {})).toBe(true);
    expect(
      evaluateJobIf("github.event_name == 'push'", {}, undefined, {
        github: { event_name: "push" },
      }),
    ).toBe(true);
    expect(evaluateJobIf("1 == 2", {})).toBe(false);
  });

  it("adds an implicit success() when no status function is called", () => {
    expect(evaluateJobIf("true", { build: "failure" })).toBe(false);
    expect(evaluateJobIf("always() && true", { build: "failure" })).toBe(true);
    expect(evaluateJobIf("failure()", { build: "failure" })).toBe(true);
  });

  it("reads needs results and outputs", () => {
    const needs = { build: { flag: "yes", __result: "success" } };
    expect(evaluateJobIf("needs.build.outputs.flag == 'YES'", { build: "success" }, needs)).toBe(
      true,
    );
    expect(evaluateJobIf("needs.build.result == 'success'", { build: "success" }, needs)).toBe(
      true,
    );
  });
});

describe("jobIfContexts", () => {
  it("has the same static github values the runner gets", () => {
    const contexts = jobIfContexts({ repository: "acme/widgets" });
    expect(evaluateJobIf("startsWith(github.ref, 'refs/heads/')", {}, undefined, contexts)).toBe(
      true,
    );
    expect(evaluateJobIf("github.event_name == 'push'", {}, undefined, contexts)).toBe(true);
    expect(evaluateJobIf("github.repository == 'acme/widgets'", {}, undefined, contexts)).toBe(
      true,
    );
  });
});
