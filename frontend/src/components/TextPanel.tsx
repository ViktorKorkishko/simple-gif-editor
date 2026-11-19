import { NumberField } from "./NumberField";
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
  const enabled = hasText(settings);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Text</h2>
        {enabled && (
          <button type="button" className="link" onClick={() => onChange({ text: "" })}>
            Remove
          </button>
        )}
      </div>

      <label className="field">
        <span className="field-label">Caption</span>
        <textarea
          rows={2}
          maxLength={LIMITS.textLength}
          placeholder="Optional. Line breaks are kept."
          value={settings.text}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      </label>

      <fieldset className="text-options" disabled={!enabled}>
        <div className="row">
          <div className="field">
            <span className="field-label">Position</span>
            <div className="position-grid" role="radiogroup" aria-label="Text position">
              {GRID.map((position, index) =>
                position ? (
                  <button
                    key={position}
                    type="button"
                    role="radio"
                    aria-checked={settings.textPosition === position}
                    aria-label={position}
                    title={position}
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
              label="Font size"
              suffix="px"
              min={LIMITS.textSize[0]}
              max={LIMITS.textSize[1]}
              step={1}
              value={settings.textSize}
              onChange={(value) => onChange({ textSize: value ?? 32 })}
            />
            <label className="field">
              <span className="field-label">Color</span>
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
            label="Outline"
            suffix="px"
            min={LIMITS.textOutline[0]}
            max={LIMITS.textOutline[1]}
            step={1}
            value={settings.textOutline}
            onChange={(value) => onChange({ textOutline: value ?? 0 })}
          />
          <label className="field">
            <span className="field-label">Outline color</span>
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
            Background box
          </label>
          {settings.textBox && (
            <>
              <label className="field">
                <span className="field-label">Box color</span>
                <input
                  type="color"
                  value={settings.textBoxColor}
                  onChange={(event) => onChange({ textBoxColor: event.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">Opacity {Math.round(settings.textBoxOpacity * 100)}%</span>
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
            label="Show from"
            suffix="s"
            min={0}
            step={0.1}
            placeholder="start"
            value={settings.textStart}
            onChange={(value) => onChange({ textStart: value })}
          />
          <NumberField
            label="Hide at"
            suffix="s"
            min={0}
            step={0.1}
            placeholder="end"
            value={settings.textEnd}
            onChange={(value) => onChange({ textEnd: value })}
          />
        </div>
        <p className="muted small">
          Times count from the start of the GIF. Sizes are in GIF pixels. The preview is approximate.
        </p>
      </fieldset>
    </section>
  );
}
