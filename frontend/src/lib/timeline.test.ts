import { describe, expect, it } from "vitest";
import { rulerTicks, tickLabel } from "./timeline";

describe("rulerTicks", () => {
  it("uses a round step with at most twelve marks", () => {
    expect(rulerTicks(12)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(rulerTicks(4)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    expect(rulerTicks(60)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    expect(rulerTicks(13)).toEqual([0, 2, 4, 6, 8, 10, 12]);
  });

  it("returns nothing for an unknown length", () => {
    expect(rulerTicks(0)).toEqual([]);
    expect(rulerTicks(Number.NaN)).toEqual([]);
  });
});

describe("tickLabel", () => {
  it("formats minutes and seconds", () => {
    expect(tickLabel(0)).toBe("0:00");
    expect(tickLabel(5)).toBe("0:05");
    expect(tickLabel(90)).toBe("1:30");
    expect(tickLabel(2.5)).toBe("0:02.5");
  });
});
