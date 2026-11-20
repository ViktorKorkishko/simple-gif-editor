import { describe, expect, it } from "vitest";
import { uk } from "../i18n/uk";
import {
  ApiError,
  describeError,
  fallbackMessage,
  filenameFromDisposition,
  serverDetail,
  settingsFromHeaders,
} from "./api";

describe("serverDetail", () => {
  it("uses a string detail as is", () => {
    expect(serverDetail({ detail: "Target size is too small" })).toBe(
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
    expect(serverDetail(body)).toBe(
      "fps: Input should be less than or equal to 30; width: Input should be greater than or equal to 16",
    );
  });

  it("returns null when there is no detail", () => {
    expect(serverDetail(null)).toBeNull();
    expect(serverDetail("oops")).toBeNull();
  });
});

describe("fallbackMessage", () => {
  it("explains the status", () => {
    expect(fallbackMessage(413)).toMatch(/too large/);
    expect(fallbackMessage(0)).toMatch(/reach the server/);
    expect(fallbackMessage(500)).toMatch(/HTTP 500/);
    expect(fallbackMessage(413, uk.errors)).toMatch(/завелике/);
  });
});

describe("describeError", () => {
  it("shows the server's detail as is and translates the fallback", () => {
    expect(describeError(new ApiError(422, "Target size is too small"), uk.errors)).toBe(
      "Target size is too small",
    );
    expect(describeError(new ApiError(0, null), uk.errors)).toMatch(/сервером/);
    expect(describeError(new Error("boom"))).toBe("boom");
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
