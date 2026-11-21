import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { EffectIcon, FilmIcon, MarkInIcon, MarkOutIcon, TextIcon } from "./Icons";
import { NumberField } from "./NumberField";
import { useI18n } from "../i18n/I18nProvider";
import { roundTime } from "../lib/format";
import { rulerTicks, tickLabel } from "../lib/timeline";
import { activeTexts, clipLength, type EditorSettings } from "../lib/settings";

interface Props {
  settings: EditorSettings;
  /** Length of the video, or null while unknown or when the browser can't play it. */
  duration: number | null;
  time: number;
  onChange: (patch: Partial<EditorSettings>) => void;
  /** Move the preview to this time. */
  onSeek: (seconds: number) => void;
  selectedText: string | null;
  /** A caption's clip was clicked. */
  onTextClick: (id: string) => void;
  selectedEffect: string | null;
  /** An effect's clip was clicked. */
  onEffectClick: (id: string) => void;
}

/** Shortest clip the handles allow, in seconds. */
const MIN_CLIP = 0.1;
/** Arrow keys move the playhead by about one frame and the handles by a tenth of a second. */
const FRAME = 1 / 30;

type Drag = "scrub" | "start" | "end";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function Timeline({
  settings,
  duration,
  time,
  onChange,
  onSeek,
  selectedText,
  onTextClick,
  selectedEffect,
  onEffectClick,
}: Props) {
  const { t } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const { start } = settings;
  const end = settings.end ?? duration;
  const length = clipLength(settings, duration);

  const setStart = (value: number) => {
    const limit = end === null ? Infinity : end - MIN_CLIP;
    const next = roundTime(clamp(value, 0, Math.max(0, limit)));
    onChange({ start: next });
    onSeek(next);
  };

  const setEnd = (value: number | null) => {
    if (value === null) {
      onChange({ end: null });
      return;
    }
    const max = duration ?? Infinity;
    const next = roundTime(clamp(value, start + MIN_CLIP, max));
    // Reaching the very end is the same as not trimming the end.
    onChange({ end: duration !== null && next >= duration ? null : next });
    onSeek(Math.min(next, max));
  };

  /** "Start here" past the current end moves the end to the end of the video. */
  const startAtPlayhead = () => {
    const next = roundTime(clamp(time, 0, duration === null ? time : duration - MIN_CLIP));
    const pastEnd = end !== null && next > end - MIN_CLIP;
    onChange(pastEnd ? { start: next, end: null } : { start: next });
  };
  /** "End here" before the current start moves the start to the beginning of the video. */
  const endAtPlayhead = () => {
    if (time < start + MIN_CLIP) {
      onChange({ start: 0, end: roundTime(Math.max(time, MIN_CLIP)) });
      return;
    }
    setEnd(time);
  };

  const timeAt = (event: PointerEvent) => {
    const box = track.current?.getBoundingClientRect();
    if (!box || !box.width || duration === null) return 0;
    return clamp((event.clientX - box.left) / box.width, 0, 1) * duration;
  };

  const apply = (kind: Drag, seconds: number) => {
    if (kind === "scrub") onSeek(clamp(seconds, 0, duration ?? 0));
    else if (kind === "start") setStart(seconds);
    else setEnd(seconds);
  };

  const pointerHandlers = (kind: Drag) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = kind;
      if (kind === "scrub") apply(kind, timeAt(event));
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      if (drag.current === kind) apply(kind, timeAt(event));
    },
    onPointerUp: () => {
      drag.current = null;
    },
    onPointerCancel: () => {
      drag.current = null;
    },
  });

  const arrows = (event: KeyboardEvent, current: number, unit: number, kind: Drag) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = (event.key === "ArrowLeft" ? -1 : 1) * unit * (event.shiftKey ? 10 : 1);
    apply(kind, current + delta);
  };

  const pct = (seconds: number) => (duration ? `${(clamp(seconds, 0, duration) / duration) * 100}%` : "0%");

  const textClips =
    length !== null && length > 0
      ? activeTexts(settings)
          .map((layer) => ({
            layer,
            from: start + Math.min(layer.start ?? 0, length),
            to: start + Math.min(layer.end ?? length, length),
          }))
          .filter((clip) => clip.to > clip.from)
      : [];
  const effectClips =
    length !== null && length > 0
      ? settings.effects
          .map((effect) => ({
            effect,
            from: start + Math.min(effect.start ?? 0, length),
            to: start + Math.min(effect.end ?? length, length),
          }))
          .filter((clip) => clip.to > clip.from)
      : [];

  return (
    <section className="timeline" aria-label={t.timeline.label}>
      <div className="timeline-toolbar">
        <div className="timeline-marks">
          <button type="button" className="button secondary small" onClick={startAtPlayhead}>
            <MarkInIcon className="accent-icon" />
            <span>{t.timeline.setStart}</span>
          </button>
          <button type="button" className="button secondary small" onClick={endAtPlayhead}>
            <span>{t.timeline.setEnd}</span>
            <MarkOutIcon className="accent-icon" />
          </button>
        </div>
        <div className="clip-range">
          <span className="clip-range-label">{t.timeline.clip}</span>
          <NumberField
            className="clip-input"
            label={t.timeline.clipStart}
            hideLabel
            suffix={t.units.seconds}
            min={0}
            max={duration ?? undefined}
            step={0.1}
            value={start}
            onChange={(value) => setStart(value ?? 0)}
          />
          <span className="muted" aria-hidden>
            –
          </span>
          <NumberField
            className="clip-input"
            label={t.timeline.clipEnd}
            hideLabel
            suffix={t.units.seconds}
            min={0}
            max={duration ?? undefined}
            step={0.1}
            value={settings.end}
            placeholder={duration === null ? t.timeline.endOfVideo : String(roundTime(duration))}
            onChange={setEnd}
          />
          {length !== null && (
            <>
              <span className="muted" aria-hidden>
                ·
              </span>
              <span className="mono">
                {length.toFixed(2)} {t.units.seconds}
              </span>
            </>
          )}
        </div>
      </div>

      {duration !== null && end !== null && (
        <div className="timeline-scroll">
          <div className="timeline-grid">
            <div className="track-labels" aria-hidden>
              <div className="ruler-spacer" />
              <div className="track-label video">
                <FilmIcon size={15} />
                <span>{t.timeline.video}</span>
              </div>
              <div className="track-label">
                <TextIcon size={15} />
                <span>{t.timeline.text}</span>
              </div>
              <div className="track-label">
                <EffectIcon size={15} />
                <span>{t.timeline.effects}</span>
              </div>
            </div>

            <div className="tracks" ref={track}>
              <div className="ruler" aria-hidden>
                {rulerTicks(duration).map((tick) => (
                  <span key={tick} className="tick" style={{ left: pct(tick) }}>
                    {tickLabel(tick)}
                  </span>
                ))}
              </div>

              <div className="video-track">
                <div className="trim-shade" style={{ left: 0, width: pct(start) }} />
                <div className="trim-shade" style={{ right: 0, width: `calc(100% - ${pct(end)})` }} />
                <div className="trim-window" style={{ left: pct(start), width: pct(end - start) }} />
              </div>

              <div className="text-track">
                {textClips.map(({ layer, from, to }) => (
                  <button
                    key={layer.id}
                    type="button"
                    className={`text-clip${layer.id === selectedText ? " selected" : ""}`}
                    style={{ left: pct(from), width: pct(to - from) }}
                    aria-pressed={layer.id === selectedText}
                    onClick={() => onTextClick(layer.id)}
                  >
                    <TextIcon size={13} />
                    <span>{layer.text}</span>
                  </button>
                ))}
              </div>

              <div className="effect-track">
                {effectClips.map(({ effect, from, to }) => (
                  <button
                    key={effect.id}
                    type="button"
                    className={`text-clip effect-clip${effect.id === selectedEffect ? " selected" : ""}`}
                    style={{ left: pct(from), width: pct(to - from) }}
                    aria-pressed={effect.id === selectedEffect}
                    onClick={() => onEffectClick(effect.id)}
                  >
                    <EffectIcon size={13} />
                    <span>{t.effects.types[effect.type]}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="scrub-area"
                aria-label={t.timeline.scrub}
                {...pointerHandlers("scrub")}
                onKeyDown={(event) => arrows(event, time, FRAME, "scrub")}
              />
              <button
                type="button"
                className="trim-handle start"
                aria-label={t.timeline.clipStart}
                style={{ left: pct(start) }}
                {...pointerHandlers("start")}
                onKeyDown={(event) => arrows(event, start, 0.1, "start")}
              >
                <span aria-hidden />
              </button>
              <button
                type="button"
                className="trim-handle end"
                aria-label={t.timeline.clipEnd}
                style={{ left: pct(end) }}
                {...pointerHandlers("end")}
                onKeyDown={(event) => arrows(event, end, 0.1, "end")}
              >
                <span aria-hidden />
              </button>
              <div className="playhead" style={{ left: pct(time) }} aria-hidden>
                <div className="playhead-line" />
                <div className="playhead-knob" />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
