import { describe, it, expect } from "vitest";
import {
  appendOutputCaptureStep,
  createOutputCaptureStep,
  resolveContinueOnErrorMode,
  wrapJobSteps,
  wrapStepScript,
} from "./step-wrapper.ts";

// ── wrapStepScript ────────────────────────────────────────────────────────────

describe("wrapStepScript", () => {
  it("wraps the original script in a retry loop", () => {
    const wrapped = wrapStepScript("npm test", "Run tests", 1);
    expect(wrapped).toContain("npm test");
    expect(wrapped).toContain('__SIGNALS="/tmp/local-ci-signals"');
    expect(wrapped).toContain("while true; do");
    expect(wrapped).toContain("Retrying step...");
  });

  it("includes the step name in the paused signal", () => {
    const wrapped = wrapStepScript("echo hi", "My Step", 2);
    expect(wrapped).toContain(
      'printf \'%s\\n%s\\n%s\' \'My Step\' "$__ATTEMPT" "$__STEP_INDEX" > "$__SIGNALS/paused"',
    );
  });

  it("escapes single quotes in step names", () => {
    const wrapped = wrapStepScript("echo hi", "it's a test", 1);
    // Should not contain an unescaped single quote that breaks the shell
    expect(wrapped).toContain("it'\\''s a test");
  });

  it("embeds step index for from-step comparison", () => {
    const wrapped = wrapStepScript("npm test", "Run tests", 3);
    expect(wrapped).toContain("__STEP_INDEX=3");
  });

  it("includes from-step skip logic with numeric comparison", () => {
    const wrapped = wrapStepScript("npm test", "Run tests", 2);
    expect(wrapped).toContain('if [ -f "$__SIGNALS/from-step" ]');
    expect(wrapped).toContain('"$__STEP_INDEX" -lt "$__FROM_STEP"');
    expect(wrapped).toContain("Skipping step $__STEP_INDEX");
    expect(wrapped).toContain("Resuming from step $__STEP_INDEX.");
  });

  it("supports wildcard * for --from-start", () => {
    const wrapped = wrapStepScript("npm test", "My Step", 1);
    expect(wrapped).toContain(`"$__FROM_STEP" != '*'`);
  });

  it("captures output via tee to signals dir", () => {
    const wrapped = wrapStepScript("npm test", "Run tests", 1);
    expect(wrapped).toContain('> >(tee "$__SIGNALS/step-output") 2>&1');
  });
});

// ── wrapJobSteps ──────────────────────────────────────────────────────────────

describe("wrapJobSteps", () => {
  const scriptStep = {
    Name: "Run tests",
    Reference: { Type: "Script" },
    Inputs: { script: "npm test" },
  };

  const usesStep = {
    Name: "Checkout",
    Reference: { Type: "Repository", Name: "actions/checkout" },
    Inputs: {},
  };

  it("returns steps unchanged when pauseOnFailure is false", () => {
    const result = wrapJobSteps([scriptStep, usesStep], false);
    expect(result).toEqual([scriptStep, usesStep]);
  });

  it("wraps run: steps when pauseOnFailure is true", () => {
    const result = wrapJobSteps([scriptStep, usesStep], true);
    expect(result[0].Inputs.script).toContain("__SIGNALS");
    expect(result[0].Inputs.script).toContain("npm test");
  });

  it("leaves uses: steps untouched", () => {
    const result = wrapJobSteps([scriptStep, usesStep], true);
    expect(result[1]).toEqual(usesStep);
  });

  it("handles undefined/empty steps gracefully", () => {
    expect(wrapJobSteps([], true)).toEqual([]);
    expect(wrapJobSteps(undefined as any, false)).toBeUndefined();
  });

  it("assigns correct 1-based step indices", () => {
    // uses step at index 0 (step 1), script at index 1 (step 2)
    const result = wrapJobSteps([usesStep, scriptStep], true);
    expect(result[1].Inputs.script).toContain("__STEP_INDEX=2");
  });

  it("assigns sequential indices across multiple script steps", () => {
    const step2 = { ...scriptStep, Name: "Build" };
    const result = wrapJobSteps([scriptStep, step2], true);
    expect(result[0].Inputs.script).toContain("__STEP_INDEX=1");
    expect(result[1].Inputs.script).toContain("__STEP_INDEX=2");
  });
});

describe("createOutputCaptureStep", () => {
  it("runs with always() so failed jobs still report their outputs", () => {
    const step = createOutputCaptureStep();
    // The DTU job generator reads the lowercase `condition` key and
    // defaults to success() otherwise.
    expect(step.condition).toBe("always()");
    expect(step).not.toHaveProperty("Condition");
  });

  it("is appended after the job's own steps", () => {
    const steps = appendOutputCaptureStep([{ Name: "build" }]);
    expect(steps.map((s) => s.Name)).toEqual(["build", "__local_ci_output_capture"]);
    expect(appendOutputCaptureStep([])).toEqual([]);
  });
});

describe("continue-on-error under --pause-on-failure", () => {
  const steps = [
    {
      Name: "soft",
      Reference: { Type: "Script" },
      Inputs: { script: "exit 3" },
      continueOnError: true,
    },
    { Name: "hard", Reference: { Type: "Script" }, Inputs: { script: "exit 1" } },
  ];

  it("pauses on continue-on-error steps by default", () => {
    const wrapped = wrapJobSteps(steps, true);
    expect(wrapped[0].Inputs.script).toContain("Paused");
    expect(wrapped[1].Inputs.script).toContain("Paused");
  });

  it("leaves continue-on-error steps to the runner in continue mode", () => {
    const wrapped = wrapJobSteps(steps, true, { pauseContinueOnErrorSteps: false });
    expect(wrapped[0].Inputs.script).toBe("exit 3");
    expect(wrapped[0].continueOnError).toBe(true);
    expect(wrapped[1].Inputs.script).toContain("Paused");
  });

  it("resolves the mode from LOCAL_CI_CONTINUE_ON_ERROR", () => {
    expect(resolveContinueOnErrorMode(undefined)).toBe("pause");
    expect(resolveContinueOnErrorMode("continue")).toBe("continue");
    expect(resolveContinueOnErrorMode(" Continue ")).toBe("continue");
    expect(resolveContinueOnErrorMode("pause")).toBe("pause");
    expect(resolveContinueOnErrorMode("bogus")).toBe("pause");
  });
});
