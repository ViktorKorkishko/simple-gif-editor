import { type CSSProperties, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { activeTexts, type EditorSettings, type TextLayer, type TextPosition } from "../lib/settings";

// Must match EDGE_MARGIN and BOX_PADDING in backend/app/overlay.py.
const EDGE_MARGIN = 10;
const BOX_PADDING = 6;

export interface VideoPreviewHandle {
  seek: (seconds: number) => void;
  currentTime: () => number;
  /** Play from the clip start if the playhead is outside the clip, or pause. */
  togglePlay: () => void;
  /** Pause and move by this many seconds. */
  step: (seconds: number) => void;
}

export interface VideoMetadata {
  duration: number | null;
  width: number;
  height: number;
}

interface Props {
  src: string;
  settings: EditorSettings;
  /** Width of the GIF in pixels, used to scale the text preview. */
  gifWidth: number;
  onMetadata: (metadata: VideoMetadata) => void;
  onTime: (seconds: number) => void;
  onPlayingChange: (playing: boolean) => void;
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

function TextPreview({ layer, scale }: { layer: TextLayer; scale: number }) {
  return (
    <div
      className="text-preview"
      style={{
        ...placement(layer.position, EDGE_MARGIN * scale),
        fontSize: layer.size * scale,
        color: layer.color,
        WebkitTextStroke: layer.outline > 0 ? `${layer.outline * 2 * scale}px ${layer.outlineColor}` : undefined,
        background: layer.box ? withOpacity(layer.boxColor, layer.boxOpacity) : undefined,
        // drawtext grows the box outwards from the text, so the text keeps its place.
        padding: layer.box ? BOX_PADDING * scale : 0,
        margin: layer.box ? -BOX_PADDING * scale : 0,
      }}
    >
      {layer.text}
    </div>
  );
}

/**
 * The source video with the trim range looped and an approximate preview of
 * the text overlays drawn on top. The final GIF is rendered by FFmpeg, so the
 * text may differ slightly. Playback is driven by the editor's own controls.
 */
export const VideoPreview = forwardRef<VideoPreviewHandle, Props>(function VideoPreview(
  { src, settings, gifWidth, onMetadata, onTime, onPlayingChange, onUnplayable },
  ref,
) {
  const video = useRef<HTMLVideoElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const { start, end } = settings;

  const report = useCallback(
    (seconds: number) => {
      setTime(seconds);
      onTime(seconds);
    },
    [onTime],
  );

  useImperativeHandle(ref, () => ({
    seek: (seconds) => {
      const element = video.current;
      if (!element) return;
      element.currentTime = seconds;
      report(seconds);
    },
    currentTime: () => video.current?.currentTime ?? 0,
    togglePlay: () => {
      const element = video.current;
      if (!element) return;
      if (element.paused) {
        const stop = end ?? element.duration;
        if (element.currentTime < start || element.currentTime >= stop - 0.05) {
          element.currentTime = start;
        }
        void element.play().catch(() => {
          // Autoplay rules or a decoding error; the play button simply stays a play button.
        });
      } else {
        element.pause();
      }
    },
    step: (seconds) => {
      const element = video.current;
      if (!element) return;
      element.pause();
      const max = Number.isFinite(element.duration) ? element.duration : Infinity;
      const next = Math.min(max, Math.max(0, element.currentTime + seconds));
      element.currentTime = next;
      report(next);
    },
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

  useEffect(() => {
    onPlayingChange(playing);
  }, [playing, onPlayingChange]);

  // timeupdate only fires a few times a second; follow the frames while playing
  // so the playhead and the text preview move smoothly.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const element = video.current;
      if (element) {
        // Loop the trimmed range so it previews like the GIF will.
        const stop = end ?? element.duration;
        if (Number.isFinite(stop) && element.currentTime >= stop) element.currentTime = start;
        report(element.currentTime);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, start, end, report]);

  const gifTime = time - start;
  const visibleTexts = activeTexts(settings).filter(
    (layer) => (layer.start === null || gifTime >= layer.start) && (layer.end === null || gifTime < layer.end),
  );

  const scale = rect ? rect.width / gifWidth : 1;

  return (
    <div className="video-frame">
      <video
        ref={video}
        src={src}
        playsInline
        muted
        preload="auto"
        onLoadedMetadata={(event) => {
          const element = event.currentTarget;
          const duration = element.duration;
          onMetadata({
            duration: Number.isFinite(duration) ? duration : null,
            width: element.videoWidth,
            height: element.videoHeight,
          });
          measure();
        }}
        onSeeked={(event) => report(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={(event) => {
          // A clip that runs to the end of the video loops like the GIF will.
          const element = event.currentTarget;
          element.currentTime = start;
          void element.play().catch(() => setPlaying(false));
        }}
        onError={onUnplayable}
      />
      {rect && visibleTexts.length > 0 && (
        <div
          className="text-layer"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
          aria-hidden
        >
          {visibleTexts.map((layer) => (
            <TextPreview key={layer.id} layer={layer} scale={scale} />
          ))}
        </div>
      )}
    </div>
  );
});
