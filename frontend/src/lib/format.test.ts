import { describe, expect, it } from "vitest";
import { formatBytes, formatTime } from "./format";

describe("formatBytes", () => {
  it("picks a readable unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(200 * 1024)).toBe("200 KB");
    expect(formatBytes(1105437)).toBe("1.05 MB");
    expect(formatBytes(1536, { b: "Б", kb: "КБ", mb: "МБ" })).toBe("1.5 КБ");
  });
});

describe("formatTime", () => {
  it("formats minutes and tenths", () => {
    expect(formatTime(0)).toBe("0:00.0");
    expect(formatTime(75.25)).toBe("1:15.3");
    expect(formatTime(59.97)).toBe("1:00.0");
  });
});
