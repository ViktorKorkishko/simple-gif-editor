import { describe, expect, it } from "vitest";
import { uk } from "../i18n/uk";
import {
  DEFAULT_SETTINGS,
  clipLength,
  newEffect,
  newTextLayer,
  toFormFields,
  validate,
  type EditorSettings,
  type TextLayer,
} from "./settings";

const make = (patch: Partial<EditorSettings> = {}): EditorSettings => ({
  ...DEFAULT_SETTINGS,
  ...patch,
});

describe("toFormFields", () => {
  it("sends only the preset by default", () => {
    expect(toFormFields(make(), 10)).toEqual({ preset: "medium" });
  });

  it("sends the trim range, leaving out an end at the end of the video", () => {
    expect(toFormFields(make({ start: 1.5, end: 4 }), 10)).toMatchObject({ start: "1.5", end: "4" });
    expect(toFormFields(make({ start: 1.5, end: 10 }), 10)).not.toHaveProperty("end");
    expect(toFormFields(make({ end: 3 }), null)).toMatchObject({ end: "3" });
  });

  it("sends overrides and the target size only in target mode", () => {
    const overrides = { fps: 20, width: null, colors: 64, lossy: null };
    expect(toFormFields(make({ overrides }), 10)).toEqual({
      preset: "medium",
      fps: "20",
      colors: "64",
    });
    expect(toFormFields(make({ targetSizeKb: 500 }), 10)).not.toHaveProperty("target_size_kb");
    expect(toFormFields(make({ mode: "target", targetSizeKb: 500 }), 10)).toMatchObject({
      target_size_kb: "500",
    });
  });

  it("sends the format unless it is GIF, and colors only for GIF", () => {
    const overrides = { fps: null, width: null, colors: 64, lossy: 30 };
    expect(toFormFields(make({ overrides }), 10)).toMatchObject({ colors: "64" });
    expect(toFormFields(make({ overrides, format: "gif" }), 10)).not.toHaveProperty("format");
    const webp = toFormFields(make({ overrides, format: "webp" }), 10);
    expect(webp).toMatchObject({ format: "webp", lossy: "30" });
    expect(webp).not.toHaveProperty("colors");
  });

  it("sends text layers with text as JSON", () => {
    expect(toFormFields(make({ texts: [newTextLayer({ text: "   " })] }), 10)).not.toHaveProperty("texts");
    const texts = [
      newTextLayer({ text: "Hi", box: true, boxColor: "#112233", boxOpacity: 0.3, end: 2 }),
      newTextLayer({ text: "" }),
      newTextLayer({ text: "Bye", position: "top", start: 1.23456 }),
    ];
    const fields = toFormFields(make({ texts }), 10);
    expect(JSON.parse(fields.texts)).toEqual([
      {
        text: "Hi",
        size: 32,
        color: "#ffffff",
        position: "bottom",
        outline: 2,
        outline_color: "#000000",
        box: true,
        box_color: "#112233@0.30",
        end: 2,
      },
      {
        text: "Bye",
        size: 32,
        color: "#ffffff",
        position: "top",
        outline: 2,
        outline_color: "#000000",
        start: 1.235,
      },
    ]);
  });
});

describe("effects", () => {
  it("sends effects as JSON", () => {
    expect(toFormFields(make(), 10)).not.toHaveProperty("effects");
    const effects = [newEffect({ type: "blur", amount: 40, start: 1, end: 2 }), newEffect({ type: "sepia" })];
    expect(JSON.parse(toFormFields(make({ effects }), 10).effects)).toEqual([
      { type: "blur", amount: 40, start: 1, end: 2 },
      { type: "sepia", amount: 100 },
    ]);
  });

  it("checks effect timing", () => {
    expect(validate(make({ effects: [newEffect({ start: 2, end: 1 })] }), 10)).toEqual([
      "Effect must end after it starts.",
    ]);
    const effects = [newEffect(), newEffect({ start: 20 })];
    expect(validate(make({ effects }), 10)).toEqual(["Effect 2: Effect must start before the GIF ends."]);
  });
});

describe("validate", () => {
  it("accepts the defaults", () => {
    expect(validate(make(), 10)).toEqual([]);
  });

  it("rejects a bad trim range", () => {
    expect(validate(make({ start: 5, end: 3 }), 10)).toContain("End must be after the start.");
    expect(validate(make({ end: 12 }), 10)).toContain("End is past the end of the video.");
    expect(validate(make({ start: 10 }), 10)).toContain(
      "Start must be before the end of the video.",
    );
  });

  it("checks text timing against the clip length", () => {
    const layer = (patch: Partial<TextLayer>) => [newTextLayer({ text: "a", ...patch })];
    expect(validate(make({ start: 2, end: 4, texts: layer({ start: 3 }) }), 10)).toContain(
      "Text must appear before the GIF ends.",
    );
    expect(validate(make({ texts: layer({ start: 2, end: 1 }) }), 10)).toContain(
      "Text must disappear after it appears.",
    );
    // Timing is ignored when there is no caption.
    expect(validate(make({ texts: layer({ text: "", start: 2, end: 1 }) }), 10)).toEqual([]);
  });

  it("names the layer when there are several", () => {
    const texts = [newTextLayer({ text: "a" }), newTextLayer({ text: "b", size: 500 })];
    expect(validate(make({ texts }), 10)).toEqual(["Text 2: Font size must be between 8 and 200."]);
  });

  it("checks overrides and the target size", () => {
    const overrides = { fps: 60, width: null, colors: null, lossy: null };
    expect(validate(make({ overrides }), 10)).toContain("FPS must be between 1 and 30.");
    expect(validate(make({ mode: "target", targetSizeKb: 5 }), 10)).toContain(
      "Target size must be at least 10 KB.",
    );
    expect(validate(make({ mode: "target", targetSizeKb: null }), 10)).toHaveLength(1);
  });

  it("reports problems in the given language", () => {
    const overrides = { fps: 60, width: null, colors: null, lossy: null };
    expect(validate(make({ overrides }), 10, uk.validation)).toEqual([
      "Кадр/с: значення має бути від 1 до 30.",
    ]);
  });
});

describe("clipLength", () => {
  it("uses the video duration when there is no end", () => {
    expect(clipLength(make({ start: 2 }), 10)).toBe(8);
    expect(clipLength(make({ start: 2, end: 5 }), 10)).toBe(3);
    expect(clipLength(make(), null)).toBeNull();
  });
});
