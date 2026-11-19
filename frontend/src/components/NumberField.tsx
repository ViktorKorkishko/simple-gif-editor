import { useEffect, useId, useState } from "react";

interface Props {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  suffix?: string;
  hint?: string;
}

/**
 * A number input that tolerates half-typed values ("1.", "") without fighting
 * the user, and reports `null` when it is empty.
 */
export function NumberField({ label, value, onChange, min, max, step, placeholder, suffix, hint }: Props) {
  const id = useId();
  const [text, setText] = useState(value === null ? "" : String(value));

  useEffect(() => {
    const parsed = text.trim() === "" ? null : Number(text);
    if (parsed !== value) setText(value === null ? "" : String(value));
    // Only resync when the value changes from outside.
  }, [value]);

  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={text}
          min={min}
          max={max}
          step={step ?? "any"}
          placeholder={placeholder}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            if (next.trim() === "") onChange(null);
            else if (Number.isFinite(Number(next))) onChange(Number(next));
          }}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
