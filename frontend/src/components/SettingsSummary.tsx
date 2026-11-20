import { useI18n } from "../i18n/I18nProvider";
import type { GifSettings } from "../lib/api";

export function SettingsSummary({ settings }: { settings: GifSettings }) {
  const { t } = useI18n();
  const parts = [
    t.summary.fps(settings.fps),
    `${settings.width} ${t.units.px}`,
    t.summary.colors(settings.colors),
  ];
  if (settings.lossy) parts.push(t.summary.lossy(settings.lossy));
  return <span className="settings-summary">{parts.join(" · ")}</span>;
}
