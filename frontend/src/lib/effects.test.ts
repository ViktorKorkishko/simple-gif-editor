import { describe, expect, it } from "vitest";
import { effectFilter, previewFilter } from "./effects";
import { newEffect } from "./settings";

describe("effectFilter", () => {
  it("matches the backend's strengths", () => {
    expect(effectFilter(newEffect({ type: "grayscale", amount: 25 }))).toBe("saturate(0.75)");
    expect(effectFilter(newEffect({ type: "sepia", amount: 50 }))).toBe("sepia(0.5)");
    expect(effectFilter(newEffect({ type: "brightness", amount: 50 }))).toBe("brightness(1.3)");
    expect(effectFilter(newEffect({ type: "contrast" }))).toBe("contrast(1.8)");
    expect(effectFilter(newEffect({ type: "saturation", amount: 50 }))).toBe("saturate(1.5)");
  });

  it("scales the blur radius to the screen", () => {
    expect(effectFilter(newEffect({ type: "blur", amount: 50 }), 2)).toBe("blur(6px)");
  });
});

describe("previewFilter", () => {
  it("combines the effects active at a time", () => {
    const effects = [
      newEffect({ type: "sepia" }),
      newEffect({ type: "blur", start: 1, end: 2 }),
      newEffect({ type: "contrast", amount: 0 }),
    ];
    expect(previewFilter(effects, 0.5)).toBe("sepia(1)");
    expect(previewFilter(effects, 1.5)).toBe("sepia(1) blur(6px)");
    expect(previewFilter([], 1)).toBeUndefined();
  });
});
