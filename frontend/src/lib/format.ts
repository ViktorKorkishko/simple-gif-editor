export interface ByteUnits {
  b: string;
  kb: string;
  mb: string;
}

const ENGLISH_UNITS: ByteUnits = { b: "B", kb: "KB", mb: "MB" };

/** Human-readable file size: 512 B, 12.3 KB, 4.56 MB. */
export function formatBytes(bytes: number, units: ByteUnits = ENGLISH_UNITS): string {
  if (bytes < 1024) return `${bytes} ${units.b}`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} ${units.kb}`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(2) : mb.toFixed(1)} ${units.mb}`;
}

/** Seconds as m:ss.s, e.g. 75.25 -> "1:15.3". */
export function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  let minutes = Math.floor(safe / 60);
  let rest = Math.round((safe - minutes * 60) * 10) / 10;
  if (rest >= 60) {
    minutes += 1;
    rest -= 60;
  }
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
}

/** Round to hundredths, which is as precise as the trim fields need to be. */
export function roundTime(seconds: number): number {
  return Math.round(seconds * 100) / 100;
}
