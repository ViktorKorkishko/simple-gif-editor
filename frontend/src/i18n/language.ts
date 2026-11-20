/** Which UI language to show, and remembering the user's choice. */

import { en, type Messages } from "./en";
import { uk } from "./uk";

export const LANGUAGES = ["en", "uk"] as const;
export type Language = (typeof LANGUAGES)[number];

export const MESSAGES: Record<Language, Messages> = { en, uk };

/** How each language is named in itself, plus a short label for the switcher. */
export const LANGUAGE_NAMES: Record<Language, { name: string; short: string }> = {
  en: { name: "English", short: "EN" },
  uk: { name: "Українська", short: "UA" },
};

export const STORAGE_KEY = "simple-gif-editor.language";

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * The saved choice if there is one, otherwise the first supported language in
 * the browser's preference list (`uk-UA` -> `uk`), otherwise English.
 */
export function pickLanguage(saved: string | null, preferred: readonly string[]): Language {
  if (isLanguage(saved)) return saved;
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLanguage(base)) return base;
  }
  return "en";
}

function readSaved(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked (private mode, disabled cookies); fall back to the browser.
    return null;
  }
}

export function initialLanguage(): Language {
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  return pickLanguage(readSaved(), preferred.filter(Boolean));
}

export function saveLanguage(language: Language): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Not remembered across visits, but the switch still works for this one.
  }
}
