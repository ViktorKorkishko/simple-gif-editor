import { describe, expect, it } from "vitest";
import { errorMessage, filenameFromDisposition, settingsFromHeaders } from "./api";

describe("errorMessage", () => {
  it("uses a string detail as is", () => {
    expect(errorMessage(422, { detail: "Target size is too small" })).toBe(
      "Target size is too small",
    );
  });

  it("joins validation errors with their field names", () => {
    const body = {
      detail: [
        { loc: ["body", "fps"], msg: "Input should be less than or equal to 30" },
        { loc: ["body", "width"], msg: "Input should be greater than or equal to 16" },
      ],
    };
    expect(errorMessage(422, body)).toBe(
      "fps: Input should be less than or equal to 30; width: Input should be greater than or equal to 16",
    );
  });

  it("falls back to the status", () => {
    expect(errorMessage(413, null)).toMatch(/too large/);
    expect(errorMessage(0, null)).toMatch(/reach the server/);
    expect(errorMessage(500, "oops")).toMatch(/HTTP 500/);
  });
});

describe("filenameFromDisposition", () => {
  it("reads plain and encoded filenames", () => {
    expect(filenameFromDisposition('attachment; filename="clip.gif"', "x.gif")).toBe("clip.gif");
    expect(
      filenameFromDisposition("attachment; filename*=utf-8''%D0%BA%D1%96%D1%82.gif", "x.gif"),
    ).toBe("кіт.gif");
    expect(filenameFromDisposition(null, "x.gif")).toBe("x.gif");
  });
});

describe("settingsFromHeaders", () => {
  it("parses the X-Gif-* headers", () => {
    const headers: Record<string, string> = {
      "X-Gif-Fps": "12",
      "X-Gif-Width": "400",
      "X-Gif-Colors": "128",
      "X-Gif-Lossy": "0",
    };
    expect(settingsFromHeaders((name) => headers[name] ?? null)).toEqual({
      fps: 12,
      width: 400,
      colors: 128,
      lossy: 0,
    });
    expect(settingsFromHeaders(() => null)).toBeNull();
  });
});
