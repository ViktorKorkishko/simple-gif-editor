/** Editor state and its translation into the API's form fields. */

import { en, type Messages } from "../i18n/en";

export const PRESETS = ["high", "medium", "low"] as const;
export type Preset = (typeof PRESETS)[number];

export const POSITIONS = [
  "top",
  "center",
  "bottom",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
export type TextPosition = (typeof POSITIONS)[number];

export type CompressionMode = "preset" | "target";

export const OUTPUT_FORMATS = ["gif", "webp", "mp4"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

/** File extension and display name of each format. */
export const FORMAT_LABELS: Record<OutputFormat, string> = { gif: "GIF", webp: "WebP", mp4: "MP4" };

/** Limits enforced by the backend; mirrored here to catch mistakes before a request. */
export const LIMITS = {
  fps: [1, 30],
  width: [16, 1920],
  colors: [2, 256],
  lossy: [0, 200],
  textSize: [8, 200],
  textOutline: [0, 10],
  textLength: 500,
  minTargetKb: 10,
} as const;

/** Defaults the backend uses when neither a preset nor an override is given. */
export const DEFAULT_WIDTH = 480;

export interface Overrides {
  fps: number | null;
  width: number | null;
  colors: number | null;
  lossy: number | null;
}

export interface EditorSettings {
  /** Trim range in seconds; `end` null means the end of the video. */
  start: number;
  end: number | null;

  text: string;
  textSize: number;
  textColor: string;
  textPosition: TextPosition;
  textOutline: number;
  textOutlineColor: string;
  textBox: boolean;
  textBoxColor: string;
  /** Box opacity from 0 to 1. */
  textBoxOpacity: number;
  /** Seconds from the start of the GIF; null means the whole GIF. */
  textStart: number | null;
  textEnd: number | null;

  format: OutputFormat;
  mode: CompressionMode;
  preset: Preset;
  overrides: Overrides;
  targetSizeKb: number | null;
}

export const DEFAULT_SETTINGS: EditorSettings = {
  start: 0,
  end: null,
  text: "",
  textSize: 32,
  textColor: "#ffffff",
  textPosition: "bottom",
  textOutline: 2,
  textOutlineColor: "#000000",
  textBox: false,
  textBoxColor: "#000000",
  textBoxOpacity: 0.5,
  textStart: null,
  textEnd: null,
  format: "gif",
  mode: "preset",
  preset: "medium",
  overrides: { fps: null, width: null, colors: null, lossy: null },
  targetSizeKb: 2048,
};

// Differences below this are float noise from the video element, not a real trim.
const EPSILON = 0.005;

export function hasText(settings: EditorSettings): boolean {
  return settings.text.trim().length > 0;
}

/** Length of the GIF in seconds, or null if the video duration is unknown. */
export function clipLength(settings: EditorSettings, duration: number | null): number | null {
  const end = settings.end ?? duration;
  return end === null ? null : Math.max(0, end - settings.start);
}

function inRange(value: number, [min, max]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/** Problems that would make the backend reject the request, in plain words. */
export function validate(
  settings: EditorSettings,
  duration: number | null,
  messages: Messages["validation"] = en.validation,
): string[] {
  const errors: string[] = [];
  const { start, end } = settings;

  if (!Number.isFinite(start) || start < 0) errors.push(messages.startNegative);
  if (duration !== null && start >= duration) errors.push(messages.startAfterVideo);
  if (end !== null) {
    if (!Number.isFinite(end) || end <= start) errors.push(messages.endBeforeStart);
    else if (duration !== null && end > duration + EPSILON) errors.push(messages.endAfterVideo);
  }

  if (hasText(settings)) {
    if (settings.text.length > LIMITS.textLength) errors.push(messages.textTooLong(LIMITS.textLength));
    if (!inRange(settings.textSize, LIMITS.textSize))
      errors.push(messages.fontSize(...LIMITS.textSize));
    if (!inRange(settings.textOutline, LIMITS.textOutline))
      errors.push(messages.outline(...LIMITS.textOutline));
    const { textStart, textEnd } = settings;
    const length = clipLength(settings, duration);
    if (textStart !== null && length !== null && textStart >= length)
      errors.push(messages.textAfterGif);
    if (textStart !== null && textEnd !== null && textEnd <= textStart)
      errors.push(messages.textHiddenBeforeShown);
  }

  const overrideKeys: (keyof Overrides)[] = ["fps", "width", "colors", "lossy"];
  for (const key of overrideKeys) {
    const value = settings.overrides[key];
    const limits = LIMITS[key];
    if (value !== null && !inRange(value, limits))
      errors.push(messages.overrideRange(messages.overrideLabels[key], limits[0], limits[1]));
  }

  if (settings.mode === "target") {
    const target = settings.targetSizeKb;
    if (target === null || !Number.isFinite(target) || target < LIMITS.minTargetKb)
      errors.push(messages.targetTooSmall(LIMITS.minTargetKb));
  }

  return errors;
}

function seconds(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/** Form fields for /api/convert and /api/estimate, leaving out anything at its default. */
export function toFormFields(
  settings: EditorSettings,
  duration: number | null,
): Record<string, string> {
  const fields: Record<string, string> = { preset: settings.preset };
  if (settings.format !== "gif") fields.format = settings.format;

  if (settings.start > EPSILON) fields.start = seconds(settings.start);
  if (settings.end !== null && (duration === null || settings.end < duration - EPSILON))
    fields.end = seconds(settings.end);

  for (const [key, value] of Object.entries(settings.overrides)) {
    // The palette size only exists for GIF.
    if (value !== null && (key !== "colors" || settings.format === "gif")) fields[key] = String(value);
  }
  if (settings.mode === "target" && settings.targetSizeKb !== null)
    fields.target_size_kb = String(Math.round(settings.targetSizeKb));

  if (hasText(settings)) {
    fields.text = settings.text;
    fields.text_size = String(settings.textSize);
    fields.text_color = settings.textColor;
    fields.text_position = settings.textPosition;
    fields.text_outline = String(settings.textOutline);
    fields.text_outline_color = settings.textOutlineColor;
    if (settings.textBox) {
      fields.text_box = "true";
      fields.text_box_color = `${settings.textBoxColor}@${settings.textBoxOpacity.toFixed(2)}`;
    }
    if (settings.textStart !== null) fields.text_start = seconds(settings.textStart);
    if (settings.textEnd !== null) fields.text_end = seconds(settings.textEnd);
  }

  return fields;
}
