import { describe, expect, it } from "vitest";
import { en } from "./en";
import { pickLanguage } from "./language";
import { uk } from "./uk";

describe("pickLanguage", () => {
  it("prefers the saved choice", () => {
    expect(pickLanguage("uk", ["en-US"])).toBe("uk");
    expect(pickLanguage("en", ["uk-UA"])).toBe("en");
  });

  it("ignores an unknown saved value", () => {
    expect(pickLanguage("de", ["uk"])).toBe("uk");
  });

  it("uses the first supported browser language", () => {
    expect(pickLanguage(null, ["uk-UA", "en"])).toBe("uk");
    expect(pickLanguage(null, ["de-DE", "UK", "en"])).toBe("uk");
    expect(pickLanguage(null, ["en-GB", "uk"])).toBe("en");
  });

  it("falls back to English", () => {
    expect(pickLanguage(null, ["de-DE", "fr"])).toBe("en");
    expect(pickLanguage(null, [])).toBe("en");
  });
});

describe("messages", () => {
  it("picks the Ukrainian plural form for colors", () => {
    expect(uk.summary.colors(1)).toBe("1 колір");
    expect(uk.summary.colors(64)).toBe("64 кольори");
    expect(uk.summary.colors(128)).toBe("128 кольорів");
    expect(en.summary.colors(1)).toBe("1 color");
    expect(en.summary.colors(256)).toBe("256 colors");
  });
});
