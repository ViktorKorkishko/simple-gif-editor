import { type CSSProperties, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { hasText, type EditorSettings, type TextPosition } from "../lib/settings";

// Must match EDGE_MARGIN and BOX_PADDING in backend/app/overlay.py.
const EDGE_MARGIN = 10;
const BOX_PADDING = 6;

export interface VideoPreviewHandle {
  seek: (seconds: number) => void;
  currentTime: () => number;
}

interface Props {
  src: string;
  settings: EditorSettings;
  /** Width of the GIF in pixels, used to scale the text preview. */
  gifWidth: number;
  onDuration: (seconds: number | null) => void;
  onUnplayable: () => void;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where the picture sits inside the <video> element once letterboxing is accounted for. */
function contentRect(video: HTMLVideoElement): Rect | null {
  const { videoWidth, videoHeight, clientWidth, clientHeight } = video;
  if (!videoWidth || !videoHeight || !clientWidth || !clientHeight) return null;
  const scale = Math.min(clientWidth / videoWidth, clientHeight / videoHeight);
  const width = videoWidth * scale;
  const height = videoHeight * scale;
  return { left: (clientWidth - width) / 2, top: (clientHeight - height) / 2, width, height };
}

function placement(position: TextPosition, margin: number): CSSProperties {
  const style: CSSProperties = {};
  const [vertical, horizontal] = position.includes("-")
    ? (position.split("-") as [string, string])
    : position === "center"
      ? ["center", "center"]
      : [position, "center"];

  if (vertical === "top") style.top = margin;
  else if (vertical === "bottom") style.bottom = margin;
  else style.top = "50%";

  if (horizontal === "left") style.left = margin;
  else if (horizontal === "right") style.right = margin;
  else style.left = "50%";

  const tx = horizontal === "center" ? "-50%" : "0";
  const ty = vertical === "center" ? "-50%" : "0";
  style.transform = `translate(${tx}, ${ty})`;
  return style;
}

function withOpacity(hex: string, opacity: number): string {
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${alpha}`;
}

/**
 * The source video with the trim range looped and an approximate preview of
 * the text overlay drawn on top. The final GIF is rendered by FFmpeg, so the
 * text may differ slightly.
 */
export const VideoPreview = forwardRef<VideoPreviewHandle, Props>(function VideoPreview(
  { src, settings, gifWidth, onDuration, onUnplayable },
  ref,
) {
  const video = useRef<HTMLVideoElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [time, setTime] = useState(0);

  useImperativeHandle(ref, () => ({
    seek: (seconds) => {
      if (video.current) video.current.currentTime = seconds;
    },
    currentTime: () => video.current?.currentTime ?? 0,
  }));

  const measure = useCallback(() => {
    if (video.current) setRect(contentRect(video.current));
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);

  const { start, end } = settings;

  const onTimeUpdate = () => {
    const element = video.current;
    if (!element) return;
    // Loop the trimmed range while playing so it previews like the GIF will.
    const stop = end ?? element.duration;
    if (!element.paused && Number.isFinite(stop) && element.currentTime >= stop) {
      element.currentTime = start;
    }
    setTime(element.currentTime);
  };

  const onPlay = () => {
    const element = video.current;
    if (!element) return;
    const stop = end ?? element.duration;
    if (element.currentTime < start || element.currentTime >= stop - 0.05) {
      element.currentTime = start;
    }
  };

  const gifTime = time - start;
  const textVisible =
    hasText(settings) &&
    (settings.textStart === null || gifTime >= settings.textStart) &&
    (settings.textEnd === null || gifTime < settings.textEnd);

  const scale = rect ? rect.width / gifWidth : 1;

  return (
    <div className="video-frame">
      <video
        ref={video}
        src={src}
        controls
        playsInline
        muted
        preload="metadata"
        onLoadedMetadata={(event) => {
          const duration = event.currentTarget.duration;
          onDuration(Number.isFinite(duration) ? duration : null);
          measure();
        }}
        onTimeUpdate={onTimeUpdate}
        onSeeked={onTimeUpdate}
        onPlay={onPlay}
        onError={onUnplayable}
      />
      {rect && textVisible && (
        <div
          className="text-layer"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
          aria-hidden
        >
          <div
            className="text-preview"
            style={{
              ...placement(settings.textPosition, EDGE_MARGIN * scale),
              fontSize: settings.textSize * scale,
              color: settings.textColor,
              WebkitTextStroke:
                settings.textOutline > 0
                  ? `${settings.textOutline * 2 * scale}px ${settings.textOutlineColor}`
                  : undefined,
              background: settings.textBox
                ? withOpacity(settings.textBoxColor, settings.textBoxOpacity)
                : undefined,
              // drawtext grows the box outwards from the text, so the text keeps its place.
              padding: settings.textBox ? BOX_PADDING * scale : 0,
              margin: settings.textBox ? -BOX_PADDING * scale : 0,
            }}
          >
            {settings.text}
          </div>
        </div>
      )}
    </div>
  );
});
