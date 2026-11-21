import { EffectIcon, PlusIcon, TrashIcon } from "./Icons";
import { NumberField } from "./NumberField";
import { SliderField } from "./SliderField";
import { useI18n } from "../i18n/I18nProvider";
import { formatTimecode } from "../lib/format";
import { EFFECT_TYPES, LIMITS, type EffectLayer } from "../lib/settings";

interface Props {
  effects: EffectLayer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, patch: Partial<EffectLayer>) => void;
}

export function EffectsPanel({ effects, selectedId, onSelect, onAdd, onRemove, onChange }: Props) {
  const { t } = useI18n();
  const selected = effects.find((effect) => effect.id === selectedId) ?? null;
  const full = effects.length >= LIMITS.effects;

  const range = (effect: EffectLayer) =>
    effect.start === null && effect.end === null
      ? null
      : `${formatTimecode(effect.start ?? 0)} – ${
          effect.end === null ? t.text.endPlaceholder : formatTimecode(effect.end)
        }`;

  return (
    <div className="side-panel">
      <button
        type="button"
        className="button add-layer"
        disabled={full}
        title={full ? t.effects.limit(LIMITS.effects) : undefined}
        onClick={onAdd}
      >
        <PlusIcon />
        <span>{t.effects.add}</span>
      </button>

      {effects.length > 0 && (
        <ul className="layer-list" aria-label={t.effects.list}>
          {effects.map((effect) => {
            const meta = range(effect);
            return (
              <li key={effect.id} className={`layer-card${effect.id === selectedId ? " selected" : ""}`}>
                <button
                  type="button"
                  className="layer-card-select"
                  aria-pressed={effect.id === selectedId}
                  onClick={() => onSelect(effect.id)}
                >
                  <EffectIcon />
                  <span className="layer-card-body">
                    <span className="layer-card-title">
                      {t.effects.types[effect.type]}
                      {effect.amount < 100 && <span className="muted"> · {effect.amount}%</span>}
                    </span>
                    {meta && <span className="layer-card-meta mono">{meta}</span>}
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-button ghost"
                  aria-label={t.effects.remove}
                  title={t.effects.remove}
                  onClick={() => onRemove(effect.id)}
                >
                  <TrashIcon />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <EffectEditor effect={selected} onChange={(patch) => onChange(selected.id, patch)} />
      ) : (
        <p className="note">{t.effects.none}</p>
      )}
    </div>
  );
}

function EffectEditor({ effect, onChange }: { effect: EffectLayer; onChange: (patch: Partial<EffectLayer>) => void }) {
  const { t } = useI18n();
  return (
    <>
      <div className="field">
        <span className="field-label" id="effect-type-label">
          {t.effects.type}
        </span>
        <div className="effect-types" role="radiogroup" aria-labelledby="effect-type-label">
          {EFFECT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={effect.type === type}
              onClick={() => onChange({ type })}
            >
              {t.effects.types[type]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">{t.effects.timeRange}</span>
        <div className="pair">
          <NumberField
            label={t.text.showFrom}
            hideLabel
            prefix={t.text.from}
            suffix={t.units.seconds}
            min={0}
            step={0.1}
            placeholder={t.text.startPlaceholder}
            value={effect.start}
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
            value={effect.end}
            onChange={(value) => onChange({ end: value })}
          />
        </div>
      </div>

      <SliderField
        id="effect-amount"
        label={t.effects.amount}
        value={effect.amount}
        min={0}
        max={100}
        unit="%"
        onChange={(amount) => onChange({ amount })}
      />

      <p className="note">{t.effects.note}</p>
    </>
  );
}
