import { useEffect, useId, useState } from "react";

interface Props {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /** Short text inside the box before the number, e.g. "from". */
  prefix?: string;
  suffix?: string;
  hint?: string;
  /** Keep the label for screen readers only, e.g. when a prefix already says it. */
  hideLabel?: boolean;
  className?: string;
}

/**
 * A number input that tolerates half-typed values ("1.", "") without fighting
 * the user, and reports `null` when it is empty.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  prefix,
  suffix,
  hint,
  hideLabel,
  className,
}: Props) {
  const id = useId();
  const [text, setText] = useState(value === null ? "" : String(value));

  useEffect(() => {
    const parsed = text.trim() === "" ? null : Number(text);
    if (parsed !== value) setText(value === null ? "" : String(value));
    // Only resync when the value changes from outside.
  }, [value]);

  return (
    <div className={`field${className ? ` ${className}` : ""}`}>
      <label className={hideLabel ? "visually-hidden" : "field-label"} htmlFor={id}>
        {label}
      </label>
      <span className="input-box">
        {prefix && (
          <span className="input-affix" aria-hidden>
            {prefix}
          </span>
        )}
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
        {suffix && (
          <span className="input-affix" aria-hidden>
            {suffix}
          </span>
        )}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}
