import { NumberField } from "./NumberField";
import { useI18n } from "../i18n/I18nProvider";
import { LIMITS, hasText, type EditorSettings, type TextPosition } from "../lib/settings";

interface Props {
  settings: EditorSettings;
  onChange: (patch: Partial<EditorSettings>) => void;
}

const POSITION_LABELS: Record<TextPosition, string> = {
  "top-left": "↖",
  top: "↑",
  "top-right": "↗",
  center: "•",
  "bottom-left": "↙",
  bottom: "↓",
  "bottom-right": "↘",
};

// Laid out like the frame: corners and edges around the centre.
const GRID: (TextPosition | null)[] = [
  "top-left",
  "top",
  "top-right",
  null,
  "center",
  null,
  "bottom-left",
  "bottom",
  "bottom-right",
];

export function TextPanel({ settings, onChange }: Props) {
  const { t } = useI18n();
  const enabled = hasText(settings);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{t.text.title}</h2>
        {enabled && (
          <button type="button" className="link" onClick={() => onChange({ text: "" })}>
            {t.text.remove}
          </button>
        )}
      </div>

      <label className="field">
        <span className="field-label">{t.text.caption}</span>
        <textarea
          rows={2}
          maxLength={LIMITS.textLength}
          placeholder={t.text.captionPlaceholder}
          value={settings.text}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      </label>

      <fieldset className="text-options" disabled={!enabled}>
        <div className="row">
          <div className="field">
            <span className="field-label">{t.text.position}</span>
            <div className="position-grid" role="radiogroup" aria-label={t.text.positionGroup}>
              {GRID.map((position, index) =>
                position ? (
                  <button
                    key={position}
                    type="button"
                    role="radio"
                    aria-checked={settings.textPosition === position}
                    aria-label={t.text.positions[position]}
                    title={t.text.positions[position]}
                    className={settings.textPosition === position ? "selected" : ""}
                    onClick={() => onChange({ textPosition: position })}
                  >
                    {POSITION_LABELS[position]}
                  </button>
                ) : (
                  <span key={index} />
                ),
              )}
            </div>
          </div>
          <div className="stack">
            <NumberField
              label={t.text.fontSize}
              suffix={t.units.px}
              min={LIMITS.textSize[0]}
              max={LIMITS.textSize[1]}
              step={1}
              value={settings.textSize}
              onChange={(value) => onChange({ textSize: value ?? 32 })}
            />
            <label className="field">
              <span className="field-label">{t.text.color}</span>
              <input
                type="color"
                value={settings.textColor}
                onChange={(event) => onChange({ textColor: event.target.value })}
              />
            </label>
          </div>
        </div>

        <div className="row">
          <NumberField
            label={t.text.outline}
            suffix={t.units.px}
            min={LIMITS.textOutline[0]}
            max={LIMITS.textOutline[1]}
            step={1}
            value={settings.textOutline}
            onChange={(value) => onChange({ textOutline: value ?? 0 })}
          />
          <label className="field">
            <span className="field-label">{t.text.outlineColor}</span>
            <input
              type="color"
              value={settings.textOutlineColor}
              disabled={settings.textOutline === 0}
              onChange={(event) => onChange({ textOutlineColor: event.target.value })}
            />
          </label>
        </div>

        <div className="row">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.textBox}
              onChange={(event) => onChange({ textBox: event.target.checked })}
            />
            {t.text.backgroundBox}
          </label>
          {settings.textBox && (
            <>
              <label className="field">
                <span className="field-label">{t.text.boxColor}</span>
                <input
                  type="color"
                  value={settings.textBoxColor}
                  onChange={(event) => onChange({ textBoxColor: event.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">
                  {t.text.opacity(Math.round(settings.textBoxOpacity * 100))}
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.textBoxOpacity}
                  onChange={(event) => onChange({ textBoxOpacity: Number(event.target.value) })}
                />
              </label>
            </>
          )}
        </div>

        <div className="row">
          <NumberField
            label={t.text.showFrom}
            suffix={t.units.seconds}
            min={0}
            step={0.1}
            placeholder={t.text.startPlaceholder}
            value={settings.textStart}
            onChange={(value) => onChange({ textStart: value })}
          />
          <NumberField
            label={t.text.hideAt}
            suffix={t.units.seconds}
            min={0}
            step={0.1}
            placeholder={t.text.endPlaceholder}
            value={settings.textEnd}
            onChange={(value) => onChange({ textEnd: value })}
          />
        </div>
        <p className="muted small">{t.text.note}</p>
      </fieldset>
    </section>
  );
}
