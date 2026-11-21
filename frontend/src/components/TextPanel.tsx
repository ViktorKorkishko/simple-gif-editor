import { useEffect, useState } from "react";
import { PlusIcon, TextIcon, TrashIcon } from "./Icons";
import { NumberField } from "./NumberField";
import { SliderField } from "./SliderField";
import { useI18n } from "../i18n/I18nProvider";
import { formatTimecode } from "../lib/format";
import { LIMITS, type TextLayer, type TextPosition } from "../lib/settings";

interface Props {
  texts: TextLayer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, patch: Partial<TextLayer>) => void;
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

export function TextPanel({ texts, selectedId, onSelect, onAdd, onRemove, onChange }: Props) {
  const { t } = useI18n();
  const selected = texts.find((layer) => layer.id === selectedId) ?? null;

  const range = (layer: TextLayer) =>
    layer.start === null && layer.end === null
      ? null
      : `${formatTimecode(layer.start ?? 0)} – ${
          layer.end === null ? t.text.endPlaceholder : formatTimecode(layer.end)
        }`;

  return (
    <div className="side-panel">
      <button
        type="button"
        className="button add-layer"
        disabled={texts.length >= LIMITS.textLayers}
        title={texts.length >= LIMITS.textLayers ? t.text.layerLimit(LIMITS.textLayers) : undefined}
        onClick={onAdd}
      >
        <PlusIcon />
        <span>{t.text.add}</span>
      </button>

      {texts.length > 0 && (
        <ul className="layer-list" aria-label={t.text.layers}>
          {texts.map((layer) => {
            const meta = range(layer);
            return (
              <li key={layer.id} className={`layer-card${layer.id === selectedId ? " selected" : ""}`}>
                <button
                  type="button"
                  className="layer-card-select"
                  aria-pressed={layer.id === selectedId}
                  onClick={() => onSelect(layer.id)}
                >
                  <TextIcon />
                  <span className="layer-card-body">
                    <span className={`layer-card-title${layer.text.trim() ? "" : " muted"}`}>
                      {layer.text.trim() || t.text.empty}
                    </span>
                    {meta && <span className="layer-card-meta mono">{meta}</span>}
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-button ghost"
                  aria-label={t.text.remove}
                  title={t.text.remove}
                  onClick={() => onRemove(layer.id)}
                >
                  <TrashIcon />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <LayerEditor layer={selected} onChange={(patch) => onChange(selected.id, patch)} />
      ) : (
        <p className="note">{t.text.noLayers}</p>
      )}
    </div>
  );
}

function LayerEditor({ layer, onChange }: { layer: TextLayer; onChange: (patch: Partial<TextLayer>) => void }) {
  const { t } = useI18n();
  const enabled = layer.text.trim().length > 0;
  const color = layer.color.toLowerCase();

  return (
    <>
      <div className="field">
        <label htmlFor={CAPTION_INPUT_ID} className="field-label">
          {t.text.caption}
        </label>
        <textarea
          id={CAPTION_INPUT_ID}
          rows={2}
          maxLength={LIMITS.textLength}
          placeholder={t.text.captionPlaceholder}
          value={layer.text}
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
              value={layer.start}
              onChange={(value) => onChange({ start: value })}
            />
            <NumberField
              label={t.text.hideAt}
              hideLabel
              prefix={t.text.to}
              suffix={t.units.seconds}
              min={0}
              step={0.1}
              placeholder={t.text.endPlaceholder}
              value={layer.end}
              onChange={(value) => onChange({ end: value })}
            />
          </div>
        </div>

        <SliderField
          id="text-size"
          label={t.text.size}
          value={layer.size}
          min={LIMITS.textSize[0]}
          max={LIMITS.textSize[1]}
          unit={t.units.px}
          onChange={(size) => onChange({ size })}
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
                onClick={() => onChange({ color: hex })}
              />
            ))}
            <label className="swatch custom" title={t.text.customColor} style={{ background: color }}>
              <span className="visually-hidden">{t.text.customColor}</span>
              <input type="color" value={color} onChange={(event) => onChange({ color: event.target.value })} />
            </label>
            <HexInput value={color} label={t.text.hexColor} onChange={(hex) => onChange({ color: hex })} />
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
                    aria-checked={layer.position === position}
                    aria-label={t.text.positions[position]}
                    title={t.text.positions[position]}
                    onClick={() => onChange({ position })}
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
              value={layer.outline}
              min={LIMITS.textOutline[0]}
              max={LIMITS.textOutline[1]}
              unit={t.units.px}
              onChange={(outline) => onChange({ outline })}
            />
            <label className="color-row">
              <input
                type="color"
                value={layer.outlineColor}
                disabled={!enabled || layer.outline === 0}
                onChange={(event) => onChange({ outlineColor: event.target.value })}
              />
              <span>{t.text.outlineColor}</span>
            </label>
          </div>
        </div>

        <label className="checkbox">
          <input type="checkbox" checked={layer.box} onChange={(event) => onChange({ box: event.target.checked })} />
          <span>{t.text.backgroundBox}</span>
        </label>
        {layer.box && (
          <div className="box-options">
            <label className="color-row">
              <input
                type="color"
                value={layer.boxColor}
                onChange={(event) => onChange({ boxColor: event.target.value })}
              />
              <span>{t.text.boxColor}</span>
            </label>
            <SliderField
              id="text-box-opacity"
              label={t.text.opacity}
              value={Math.round(layer.boxOpacity * 100)}
              min={0}
              max={100}
              step={5}
              unit="%"
              onChange={(percent) => onChange({ boxOpacity: percent / 100 })}
            />
          </div>
        )}

        <p className="note">{t.text.note}</p>
      </fieldset>
    </>
  );
}
