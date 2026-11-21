/** A range input with its label and current value. */
export function SliderField({
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
