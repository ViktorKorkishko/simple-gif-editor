import type { GifSettings } from "../lib/api";

export function SettingsSummary({ settings }: { settings: GifSettings }) {
  return (
    <span className="settings-summary">
      {settings.fps} fps · {settings.width}px · {settings.colors} colors
      {settings.lossy ? ` · lossy ${settings.lossy}` : ""}
    </span>
  );
}
