import { NumberField } from "./NumberField";
import { SettingsSummary } from "./SettingsSummary";
import { useI18n } from "../i18n/I18nProvider";
import type { PresetTable } from "../lib/api";
import { LIMITS, PRESETS, type EditorSettings, type Overrides } from "../lib/settings";

interface Props {
  settings: EditorSettings;
  presets: PresetTable | null;
  onChange: (patch: Partial<EditorSettings>) => void;
}

export function CompressionPanel({ settings, presets, onChange }: Props) {
  const { t } = useI18n();
  const setOverride = (key: keyof Overrides, value: number | null) =>
    onChange({ overrides: { ...settings.overrides, [key]: value } });
  const base = presets?.[settings.preset];
  const overridden = Object.values(settings.overrides).some((value) => value !== null);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{t.compression.title}</h2>
      </div>

      <div className="segmented" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={settings.mode === "preset"}
          className={settings.mode === "preset" ? "selected" : ""}
          onClick={() => onChange({ mode: "preset" })}
        >
          {t.compression.modePreset}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={settings.mode === "target"}
          className={settings.mode === "target" ? "selected" : ""}
          onClick={() => onChange({ mode: "target" })}
        >
          {t.compression.modeTarget}
        </button>
      </div>

      {settings.mode === "target" && (
        <div className="target">
          <NumberField
            label={t.compression.maxSize}
            suffix={t.units.kb}
            min={LIMITS.minTargetKb}
            step={1}
            value={settings.targetSizeKb}
            onChange={(value) => onChange({ targetSizeKb: value })}
            hint={
              settings.targetSizeKb && settings.targetSizeKb >= 1024
                ? `≈ ${(settings.targetSizeKb / 1024).toFixed(2)} ${t.units.mb}`
                : undefined
            }
          />
          <div className="chips">
            {[500, 1024, 2048, 5120, 8192].map((kb) => (
              <button
                key={kb}
                type="button"
                className={`chip${settings.targetSizeKb === kb ? " selected" : ""}`}
                onClick={() => onChange({ targetSizeKb: kb })}
              >
                {kb < 1024 ? `${kb} ${t.units.kb}` : `${kb / 1024} ${t.units.mb}`}
              </button>
            ))}
          </div>
          <p className="muted small">{t.compression.targetNote}</p>
        </div>
      )}

      <div className="preset-list" role="radiogroup" aria-label={t.compression.presetGroup}>
        {PRESETS.map((preset) => {
          const values = presets?.[preset];
          return (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={settings.preset === preset}
              className={`preset${settings.preset === preset ? " selected" : ""}`}
              onClick={() => onChange({ preset })}
            >
              <span className="preset-title">{t.compression.presets[preset].title}</span>
              <span className="muted small">{t.compression.presets[preset].note}</span>
              {values && (
                <span className="preset-values small">
                  <SettingsSummary settings={values} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <details className="advanced" open={overridden || undefined}>
        <summary>
          {t.compression.fineTune}
          {overridden ? ` (${t.compression.custom})` : ""}
        </summary>
        <p className="muted small">{t.compression.leaveEmpty}</p>
        <div className="grid-4">
          <NumberField
            label={t.compression.fps}
            min={LIMITS.fps[0]}
            max={LIMITS.fps[1]}
            step={1}
            placeholder={base ? String(base.fps) : undefined}
            value={settings.overrides.fps}
            onChange={(value) => setOverride("fps", value)}
          />
          <NumberField
            label={t.compression.width}
            suffix={t.units.px}
            min={LIMITS.width[0]}
            max={LIMITS.width[1]}
            step={1}
            placeholder={base ? String(base.width) : undefined}
            value={settings.overrides.width}
            onChange={(value) => setOverride("width", value)}
          />
          <NumberField
            label={t.compression.colors}
            min={LIMITS.colors[0]}
            max={LIMITS.colors[1]}
            step={1}
            placeholder={base ? String(base.colors) : undefined}
            value={settings.overrides.colors}
            onChange={(value) => setOverride("colors", value)}
          />
          <NumberField
            label={t.compression.lossy}
            min={LIMITS.lossy[0]}
            max={LIMITS.lossy[1]}
            step={1}
            placeholder={base ? String(base.lossy) : undefined}
            value={settings.overrides.lossy}
            onChange={(value) => setOverride("lossy", value)}
          />
        </div>
        {overridden && (
          <button
            type="button"
            className="link"
            onClick={() => onChange({ overrides: { fps: null, width: null, colors: null, lossy: null } })}
          >
            {t.compression.reset}
          </button>
        )}
      </details>
    </section>
  );
}
