import { describe, expect, it } from "vitest";
import { mostSevereResult } from "./run.ts";

describe("mostSevereResult", () => {
  it("keeps a matrix job failed when a later leg succeeds", () => {
    expect(mostSevereResult("failure", "success")).toBe("failure");
    expect(mostSevereResult("success", "failure")).toBe("failure");
  });

  it("orders failure > cancelled > success > skipped", () => {
    expect(mostSevereResult("cancelled", "success")).toBe("cancelled");
    expect(mostSevereResult("cancelled", "failure")).toBe("failure");
    expect(mostSevereResult("skipped", "success")).toBe("success");
    expect(mostSevereResult(undefined, "skipped")).toBe("skipped");
  });
});
