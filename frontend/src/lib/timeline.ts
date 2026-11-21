/** Ruler marks for the timeline. */

import { roundTime } from "./format";

const TICK_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800];
const MAX_TICKS = 12;

/** Times of the ruler marks: a round interval with at most twelve marks. */
export function rulerTicks(duration: number): number[] {
  if (!(duration > 0)) return [];
  const step =
    TICK_STEPS.find((candidate) => duration / candidate <= MAX_TICKS) ?? duration / MAX_TICKS;
  const ticks: number[] = [];
  // Skip a mark that would sit right at the end, where its label has no room.
  for (let index = 0; index * step < duration - step * 0.25; index += 1) {
    ticks.push(roundTime(index * step));
  }
  return ticks;
}

/** A ruler label: 0:05, 1:30, or 0:02.5 for half seconds. */
export function tickLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = roundTime(seconds - minutes * 60);
  const text = Number.isInteger(rest) ? String(rest).padStart(2, "0") : rest.toFixed(1).padStart(4, "0");
  return `${minutes}:${text}`;
}
