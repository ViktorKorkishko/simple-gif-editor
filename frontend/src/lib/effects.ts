/** CSS previews of the backend's effects; keep in step with backend/app/effects.py. */

import type { EffectLayer } from "./settings";

/** Blur radius at full strength, in GIF pixels. */
const MAX_BLUR = 6;

/** Whether the effect applies at `gifTime` seconds from the start of the GIF. */
export function effectActive(effect: EffectLayer, gifTime: number): boolean {
  return (effect.start === null || gifTime >= effect.start) && (effect.end === null || gifTime < effect.end);
}

/**
 * The CSS filter function matching one effect. `scale` converts GIF pixels to
 * screen pixels for the blur radius.
 */
export function effectFilter(effect: EffectLayer, scale = 1): string {
  const a = Math.min(100, Math.max(0, effect.amount)) / 100;
  const n = (value: number) => Number(value.toFixed(3));
  switch (effect.type) {
    case "grayscale":
      return `saturate(${n(1 - a)})`;
    case "sepia":
      return `sepia(${n(a)})`;
    case "blur":
      return `blur(${n(MAX_BLUR * a * scale)}px)`;
    case "brightness":
      return `brightness(${n(1 + 0.6 * a)})`;
    case "contrast":
      return `contrast(${n(1 + 0.8 * a)})`;
    case "saturation":
      return `saturate(${n(1 + a)})`;
  }
}

/** The CSS `filter` value for all effects active at `gifTime`, or undefined for none. */
export function previewFilter(effects: EffectLayer[], gifTime: number, scale = 1): string | undefined {
  const parts = effects
    .filter((effect) => effect.amount > 0 && effectActive(effect, gifTime))
    .map((effect) => effectFilter(effect, scale));
  return parts.length > 0 ? parts.join(" ") : undefined;
}
