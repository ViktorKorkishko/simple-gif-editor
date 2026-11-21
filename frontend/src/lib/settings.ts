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
  textLayers: 10,
  effects: 10,
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

/** One caption. Layers are drawn in list order, the last on top. */
export interface TextLayer {
  id: string;
  text: string;
  size: number;
  color: string;
  position: TextPosition;
  outline: number;
  outlineColor: string;
  box: boolean;
  boxColor: string;
  /** Box opacity from 0 to 1. */
  boxOpacity: number;
  /** Seconds from the start of the GIF; null means the whole GIF. */
  start: number | null;
  end: number | null;
}

export const EFFECT_TYPES = ["grayscale", "sepia", "blur", "brightness", "contrast", "saturation"] as const;
export type EffectType = (typeof EFFECT_TYPES)[number];

/** A video effect. Effects apply in list order, under the text. */
export interface EffectLayer {
  id: string;
  type: EffectType;
  /** Strength from 0 to 100. */
  amount: number;
  /** Seconds from the start of the GIF; null means the whole GIF. */
  start: number | null;
  end: number | null;
}

export interface EditorSettings {
  /** Trim range in seconds; `end` null means the end of the video. */
  start: number;
  end: number | null;

  texts: TextLayer[];
  effects: EffectLayer[];

  format: OutputFormat;
  mode: CompressionMode;
  preset: Preset;
  overrides: Overrides;
  targetSizeKb: number | null;
}

let nextLayerId = 1;

/** An empty caption with the default style. */
export function newTextLayer(patch: Partial<TextLayer> = {}): TextLayer {
  return {
    id: `text-${nextLayerId++}`,
    text: "",
    size: 32,
    color: "#ffffff",
    position: "bottom",
    outline: 2,
    outlineColor: "#000000",
    box: false,
    boxColor: "#000000",
    boxOpacity: 0.5,
    start: null,
    end: null,
    ...patch,
  };
}

let nextEffectId = 1;

export function newEffect(patch: Partial<EffectLayer> = {}): EffectLayer {
  return { id: `effect-${nextEffectId++}`, type: "grayscale", amount: 100, start: null, end: null, ...patch };
}

export const DEFAULT_SETTINGS: EditorSettings = {
  start: 0,
  end: null,
  texts: [newTextLayer()],
  effects: [],
  format: "gif",
  mode: "preset",
  preset: "medium",
  overrides: { fps: null, width: null, colors: null, lossy: null },
  targetSizeKb: 2048,
};

// Differences below this are float noise from the video element, not a real trim.
const EPSILON = 0.005;

export function hasText(layer: TextLayer): boolean {
  return layer.text.trim().length > 0;
}

/** Layers that will be drawn: the ones with text. */
export function activeTexts(settings: EditorSettings): TextLayer[] {
  return settings.texts.filter(hasText);
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

  const length = clipLength(settings, duration);
  const multiple = activeTexts(settings).length > 1;
  settings.texts.forEach((layer, index) => {
    if (!hasText(layer)) return;
    const problems: string[] = [];
    if (layer.text.length > LIMITS.textLength) problems.push(messages.textTooLong(LIMITS.textLength));
    if (!inRange(layer.size, LIMITS.textSize)) problems.push(messages.fontSize(...LIMITS.textSize));
    if (!inRange(layer.outline, LIMITS.textOutline))
      problems.push(messages.outline(...LIMITS.textOutline));
    if (layer.start !== null && length !== null && layer.start >= length)
      problems.push(messages.textAfterGif);
    if (layer.start !== null && layer.end !== null && layer.end <= layer.start)
      problems.push(messages.textHiddenBeforeShown);
    // With several captions, say which one has the problem.
    for (const problem of problems) errors.push(multiple ? messages.inLayer(index + 1, problem) : problem);
  });

  const multipleEffects = settings.effects.length > 1;
  settings.effects.forEach((effect, index) => {
    const problems: string[] = [];
    if (!inRange(effect.amount, [0, 100])) problems.push(messages.effectAmount);
    if (effect.start !== null && length !== null && effect.start >= length)
      problems.push(messages.effectAfterGif);
    if (effect.start !== null && effect.end !== null && effect.end <= effect.start)
      problems.push(messages.effectEndsBeforeStart);
    for (const problem of problems)
      errors.push(multipleEffects ? messages.inEffect(index + 1, problem) : problem);
  });

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

  const texts = activeTexts(settings);
  if (texts.length > 0) {
    fields.texts = JSON.stringify(
      texts.map((layer) => ({
        text: layer.text,
        size: layer.size,
        color: layer.color,
        position: layer.position,
        outline: layer.outline,
        outline_color: layer.outlineColor,
        ...(layer.box && { box: true, box_color: `${layer.boxColor}@${layer.boxOpacity.toFixed(2)}` }),
        ...(layer.start !== null && { start: Math.round(layer.start * 1000) / 1000 }),
        ...(layer.end !== null && { end: Math.round(layer.end * 1000) / 1000 }),
      })),
    );
  }

  if (settings.effects.length > 0) {
    fields.effects = JSON.stringify(
      settings.effects.map((effect) => ({
        type: effect.type,
        amount: Math.round(effect.amount),
        ...(effect.start !== null && { start: Math.round(effect.start * 1000) / 1000 }),
        ...(effect.end !== null && { end: Math.round(effect.end * 1000) / 1000 }),
      })),
    );
  }

  return fields;
}
