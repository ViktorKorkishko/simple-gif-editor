import { useI18n } from "../i18n/I18nProvider";
import type { GifSettings } from "../lib/api";
import type { OutputFormat } from "../lib/settings";

export function SettingsSummary({ settings, format = "gif" }: { settings: GifSettings; format?: OutputFormat }) {
  const { t } = useI18n();
  const parts = [t.summary.fps(settings.fps), `${settings.width} ${t.units.px}`];
  if (format === "gif") parts.push(t.summary.colors(settings.colors));
  if (settings.lossy)
    parts.push(format === "gif" ? t.summary.lossy(settings.lossy) : t.summary.compression(settings.lossy));
  return <span className="settings-summary">{parts.join(" · ")}</span>;
}
