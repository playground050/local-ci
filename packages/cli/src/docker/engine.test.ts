import { describe, expect, it } from "vitest";
import { isInsideContainer, looksLikePodman } from "./engine.ts";

describe("looksLikePodman", () => {
  it("recognizes Podman's version response", () => {
    expect(looksLikePodman({ Components: [{ Name: "Podman Engine" }] })).toBe(true);
    expect(looksLikePodman({ Platform: { Name: "linux/arm64/fedora-42" }, Components: [] })).toBe(
      false,
    );
  });

  it("does not match Docker", () => {
    expect(
      looksLikePodman({
        Platform: { Name: "Docker Engine - Community" },
        Components: [{ Name: "Engine" }],
      }),
    ).toBe(false);
    expect(looksLikePodman({})).toBe(false);
  });
});

describe("isInsideContainer", () => {
  it("recognizes Docker and Podman containers", () => {
    expect(isInsideContainer((p) => p === "/.dockerenv")).toBe(true);
    expect(isInsideContainer((p) => p === "/run/.containerenv")).toBe(true);
    expect(isInsideContainer(() => false)).toBe(false);
  });
});
