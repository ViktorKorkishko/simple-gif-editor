import { NumberField } from "./NumberField";
import { formatTime, roundTime } from "../lib/format";
import { clipLength, type EditorSettings } from "../lib/settings";

interface Props {
  settings: EditorSettings;
  duration: number | null;
  onChange: (patch: Partial<EditorSettings>) => void;
  /** Move the preview to this time, so the user sees the frame they picked. */
  onSeek: (seconds: number) => void;
  currentTime: () => number;
}

const STEP = 0.1;

export function TrimPanel({ settings, duration, onChange, onSeek, currentTime }: Props) {
  const end = settings.end ?? duration;
  const length = clipLength(settings, duration);

  const setStart = (value: number) => {
    const start = roundTime(Math.max(0, value));
    onChange({ start });
    onSeek(start);
  };
  const setEnd = (value: number | null) => {
    if (value === null) {
      onChange({ end: null });
      return;
    }
    const next = roundTime(duration === null ? value : Math.min(value, duration));
    // Reaching the very end is the same as not trimming the end.
    onChange({ end: duration !== null && next >= duration ? null : next });
    onSeek(next);
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Trim</h2>
        {length !== null && <span className="badge">GIF length {formatTime(length)}</span>}
      </div>

      {duration !== null && end !== null && (
        <div className="range-slider">
          <div
            className="range-fill"
            style={{
              left: `${(settings.start / duration) * 100}%`,
              right: `${100 - (end / duration) * 100}%`,
            }}
          />
          <input
            type="range"
            aria-label="Start"
            min={0}
            max={duration}
            step={STEP}
            value={settings.start}
            onChange={(event) => setStart(Math.min(Number(event.target.value), end - STEP))}
          />
          <input
            type="range"
            aria-label="End"
            min={0}
            max={duration}
            step={STEP}
            value={end}
            onChange={(event) => setEnd(Math.max(Number(event.target.value), settings.start + STEP))}
          />
        </div>
      )}

      <div className="row">
        <div className="trim-field">
          <NumberField
            label="Start"
            suffix="s"
            min={0}
            max={duration ?? undefined}
            step={STEP}
            value={settings.start}
            onChange={(value) => setStart(value ?? 0)}
          />
          <button type="button" className="link" onClick={() => setStart(currentTime())}>
            Use current frame
          </button>
        </div>
        <div className="trim-field">
          <NumberField
            label="End"
            suffix="s"
            min={0}
            max={duration ?? undefined}
            step={STEP}
            value={settings.end}
            placeholder={duration === null ? "end of video" : String(roundTime(duration))}
            onChange={setEnd}
          />
          <button type="button" className="link" onClick={() => setEnd(currentTime())}>
            Use current frame
          </button>
        </div>
      </div>
      {duration !== null && (
        <p className="muted small">
          Video length {formatTime(duration)}. Playback loops over the selected range.
        </p>
      )}
    </section>
  );
}
