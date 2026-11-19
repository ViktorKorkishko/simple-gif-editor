import { NumberField } from "./NumberField";
import type { PresetTable } from "../lib/api";
import { LIMITS, PRESETS, type EditorSettings, type Overrides, type Preset } from "../lib/settings";

interface Props {
  settings: EditorSettings;
  presets: PresetTable | null;
  onChange: (patch: Partial<EditorSettings>) => void;
}

const PRESET_LABELS: Record<Preset, { title: string; note: string }> = {
  high: { title: "High", note: "Best quality, biggest file" },
  medium: { title: "Medium", note: "Balanced" },
  low: { title: "Low", note: "Smallest file" },
};

export function CompressionPanel({ settings, presets, onChange }: Props) {
  const setOverride = (key: keyof Overrides, value: number | null) =>
    onChange({ overrides: { ...settings.overrides, [key]: value } });
  const base = presets?.[settings.preset];
  const overridden = Object.values(settings.overrides).some((value) => value !== null);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Quality and size</h2>
      </div>

      <div className="segmented" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={settings.mode === "preset"}
          className={settings.mode === "preset" ? "selected" : ""}
          onClick={() => onChange({ mode: "preset" })}
        >
          Preset
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={settings.mode === "target"}
          className={settings.mode === "target" ? "selected" : ""}
          onClick={() => onChange({ mode: "target" })}
        >
          Target size
        </button>
      </div>

      {settings.mode === "target" && (
        <div className="target">
          <NumberField
            label="Maximum GIF size"
            suffix="KB"
            min={LIMITS.minTargetKb}
            step={1}
            value={settings.targetSizeKb}
            onChange={(value) => onChange({ targetSizeKb: value })}
            hint={
              settings.targetSizeKb && settings.targetSizeKb >= 1024
                ? `≈ ${(settings.targetSizeKb / 1024).toFixed(2)} MB`
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
                {kb < 1024 ? `${kb} KB` : `${kb / 1024} MB`}
              </button>
            ))}
          </div>
          <p className="muted small">
            The preset below is the starting point. Colors, frame rate and then width are lowered
            until the GIF fits.
          </p>
        </div>
      )}

      <div className="preset-list" role="radiogroup" aria-label="Compression preset">
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
              <span className="preset-title">{PRESET_LABELS[preset].title}</span>
              <span className="muted small">{PRESET_LABELS[preset].note}</span>
              {values && (
                <span className="preset-values small">
                  {values.fps} fps · {values.width}px · {values.colors} colors
                  {values.lossy ? ` · lossy ${values.lossy}` : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <details className="advanced" open={overridden || undefined}>
        <summary>Fine-tune{overridden ? " (custom)" : ""}</summary>
        <p className="muted small">Leave a field empty to use the preset's value.</p>
        <div className="grid-4">
          <NumberField
            label="FPS"
            min={LIMITS.fps[0]}
            max={LIMITS.fps[1]}
            step={1}
            placeholder={base ? String(base.fps) : undefined}
            value={settings.overrides.fps}
            onChange={(value) => setOverride("fps", value)}
          />
          <NumberField
            label="Width"
            suffix="px"
            min={LIMITS.width[0]}
            max={LIMITS.width[1]}
            step={1}
            placeholder={base ? String(base.width) : undefined}
            value={settings.overrides.width}
            onChange={(value) => setOverride("width", value)}
          />
          <NumberField
            label="Colors"
            min={LIMITS.colors[0]}
            max={LIMITS.colors[1]}
            step={1}
            placeholder={base ? String(base.colors) : undefined}
            value={settings.overrides.colors}
            onChange={(value) => setOverride("colors", value)}
          />
          <NumberField
            label="Lossy"
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
            Reset to preset
          </button>
        )}
      </details>
    </section>
  );
}
