import { useEffect, useState } from "react";
import { TextIcon, TrashIcon } from "./Icons";
import { NumberField } from "./NumberField";
import { useI18n } from "../i18n/I18nProvider";
import { formatTimecode } from "../lib/format";
import { LIMITS, hasText, type EditorSettings, type TextPosition } from "../lib/settings";

interface Props {
  settings: EditorSettings;
  onChange: (patch: Partial<EditorSettings>) => void;
}

export const CAPTION_INPUT_ID = "caption-text";

const SWATCHES = [
  ["#ffffff", "white"],
  ["#ffd60a", "yellow"],
  ["#ff5a4d", "red"],
  ["#5ac8fa", "blue"],
  ["#000000", "black"],
] as const;

// Laid out like the frame. The backend has no middle-left or middle-right preset.
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

const HEX = /^#[0-9a-f]{6}$/i;

/** A HEX text box that only reports complete colors, so typing "#ff" doesn't reset the text. */
function HexInput({ value, label, onChange }: { value: string; label: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      type="text"
      className="hex-input mono"
      aria-label={label}
      spellCheck={false}
      maxLength={7}
      value={text}
      onChange={(event) => {
        const next = event.target.value.trim();
        setText(next);
        if (HEX.test(next)) onChange(next.toLowerCase());
      }}
      onBlur={() => setText(value)}
    />
  );
}

function SliderField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  display,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  display?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="field">
      <div className="field-row">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <span className="field-value mono">
          {display ?? value} <span className="muted">{unit}</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export function TextPanel({ settings, onChange }: Props) {
  const { t } = useI18n();
  const enabled = hasText(settings);
  const color = settings.textColor.toLowerCase();

  const range =
    settings.textStart === null && settings.textEnd === null
      ? null
      : `${formatTimecode(settings.textStart ?? 0)} – ${
          settings.textEnd === null ? t.text.endPlaceholder : formatTimecode(settings.textEnd)
        }`;

  return (
    <div className="text-panel">
      <h2 className="sidebar-title">
        <TextIcon />
        <span>{t.text.title}</span>
      </h2>

      {enabled && (
        <div className="layer-card">
          <TextIcon />
          <div className="layer-card-body">
            <span className="layer-card-title">{settings.text}</span>
            {range && <span className="layer-card-meta mono">{range}</span>}
          </div>
          <button
            type="button"
            className="icon-button ghost"
            aria-label={t.text.remove}
            title={t.text.remove}
            onClick={() => onChange({ text: "" })}
          >
            <TrashIcon />
          </button>
        </div>
      )}

      <div className="field">
        <label htmlFor={CAPTION_INPUT_ID} className="field-label">
          {t.text.caption}
        </label>
        <textarea
          id={CAPTION_INPUT_ID}
          rows={2}
          maxLength={LIMITS.textLength}
          placeholder={t.text.captionPlaceholder}
          value={settings.text}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      </div>

      <fieldset className="text-options" disabled={!enabled}>
        <div className="field">
          <span className="field-label">{t.text.timeRange}</span>
          <div className="pair">
            <NumberField
              label={t.text.showFrom}
              hideLabel
              prefix={t.text.from}
              suffix={t.units.seconds}
              min={0}
              step={0.1}
              placeholder={t.text.startPlaceholder}
              value={settings.textStart}
              onChange={(value) => onChange({ textStart: value })}
            />
            <NumberField
              label={t.text.hideAt}
              hideLabel
              prefix={t.text.to}
              suffix={t.units.seconds}
              min={0}
              step={0.1}
              placeholder={t.text.endPlaceholder}
              value={settings.textEnd}
              onChange={(value) => onChange({ textEnd: value })}
            />
          </div>
        </div>

        <SliderField
          id="text-size"
          label={t.text.size}
          value={settings.textSize}
          min={LIMITS.textSize[0]}
          max={LIMITS.textSize[1]}
          unit={t.units.px}
          onChange={(textSize) => onChange({ textSize })}
        />

        <div className="field">
          <span className="field-label">{t.text.color}</span>
          <div className="swatches">
            {SWATCHES.map(([hex, name]) => (
              <button
                key={hex}
                type="button"
                className="swatch"
                style={{ background: hex }}
                aria-label={t.text.swatches[name]}
                title={t.text.swatches[name]}
                aria-pressed={color === hex}
                onClick={() => onChange({ textColor: hex })}
              />
            ))}
            <label className="swatch custom" title={t.text.customColor} style={{ background: color }}>
              <span className="visually-hidden">{t.text.customColor}</span>
              <input
                type="color"
                value={color}
                onChange={(event) => onChange({ textColor: event.target.value })}
              />
            </label>
            <HexInput value={color} label={t.text.hexColor} onChange={(textColor) => onChange({ textColor })} />
          </div>
        </div>

        <div className="position-and-outline">
          <div className="field">
            <span className="field-label" id="text-position-label">
              {t.text.position}
            </span>
            <div className="position-grid" role="radiogroup" aria-labelledby="text-position-label">
              {GRID.map((position, index) =>
                position ? (
                  <button
                    key={position}
                    type="button"
                    role="radio"
                    aria-checked={settings.textPosition === position}
                    aria-label={t.text.positions[position]}
                    title={t.text.positions[position]}
                    onClick={() => onChange({ textPosition: position })}
                  >
                    <span aria-hidden />
                  </button>
                ) : (
                  <span key={index} className="position-gap" />
                ),
              )}
            </div>
          </div>

          <div className="stack">
            <SliderField
              id="text-outline"
              label={t.text.outline}
              value={settings.textOutline}
              min={LIMITS.textOutline[0]}
              max={LIMITS.textOutline[1]}
              unit={t.units.px}
              onChange={(textOutline) => onChange({ textOutline })}
            />
            <label className="color-row">
              <input
                type="color"
                value={settings.textOutlineColor}
                disabled={!enabled || settings.textOutline === 0}
                onChange={(event) => onChange({ textOutlineColor: event.target.value })}
              />
              <span>{t.text.outlineColor}</span>
            </label>
          </div>
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={settings.textBox}
            onChange={(event) => onChange({ textBox: event.target.checked })}
          />
          <span>{t.text.backgroundBox}</span>
        </label>
        {settings.textBox && (
          <div className="box-options">
            <label className="color-row">
              <input
                type="color"
                value={settings.textBoxColor}
                onChange={(event) => onChange({ textBoxColor: event.target.value })}
              />
              <span>{t.text.boxColor}</span>
            </label>
            <SliderField
              id="text-box-opacity"
              label={t.text.opacity}
              value={Math.round(settings.textBoxOpacity * 100)}
              min={0}
              max={100}
              step={5}
              unit="%"
              onChange={(percent) => onChange({ textBoxOpacity: percent / 100 })}
            />
          </div>
        )}

        <p className="note">{t.text.note}</p>
      </fieldset>
    </div>
  );
}
