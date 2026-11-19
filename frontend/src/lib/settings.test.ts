import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, clipLength, toFormFields, validate, type EditorSettings } from "./settings";

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

  it("sends text fields only when there is text", () => {
    expect(toFormFields(make({ text: "   " }), 10)).not.toHaveProperty("text");
    const fields = toFormFields(
      make({ text: "Hi", textBox: true, textBoxColor: "#112233", textBoxOpacity: 0.3, textEnd: 2 }),
      10,
    );
    expect(fields).toMatchObject({
      text: "Hi",
      text_size: "32",
      text_color: "#ffffff",
      text_position: "bottom",
      text_box: "true",
      text_box_color: "#112233@0.30",
      text_end: "2",
    });
    expect(fields).not.toHaveProperty("text_start");
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
    expect(validate(make({ text: "a", start: 2, end: 4, textStart: 3 }), 10)).toContain(
      "Text must appear before the GIF ends.",
    );
    expect(validate(make({ text: "a", textStart: 2, textEnd: 1 }), 10)).toContain(
      "Text must disappear after it appears.",
    );
    // Timing is ignored when there is no caption.
    expect(validate(make({ textStart: 2, textEnd: 1 }), 10)).toEqual([]);
  });

  it("checks overrides and the target size", () => {
    const overrides = { fps: 60, width: null, colors: null, lossy: null };
    expect(validate(make({ overrides }), 10)).toContain("FPS must be between 1 and 30.");
    expect(validate(make({ mode: "target", targetSizeKb: 5 }), 10)).toContain(
      "Target size must be at least 10 KB.",
    );
    expect(validate(make({ mode: "target", targetSizeKb: null }), 10)).toHaveLength(1);
  });
});

describe("clipLength", () => {
  it("uses the video duration when there is no end", () => {
    expect(clipLength(make({ start: 2 }), 10)).toBe(8);
    expect(clipLength(make({ start: 2, end: 5 }), 10)).toBe(3);
    expect(clipLength(make(), null)).toBeNull();
  });
});
