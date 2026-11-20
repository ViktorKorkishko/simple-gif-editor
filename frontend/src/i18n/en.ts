/** English UI text. Every other language must provide the same keys. */

import type { TextPosition, Preset } from "../lib/settings";

const plural = new Intl.PluralRules("en");

export const en = {
  app: {
    title: "Simple GIF Editor",
    tagline: "Turn a video clip into a GIF: trim it, add a caption, pick the size.",
    unplayable:
      "Your browser can't play this format, so there is no preview. You can still set the trim range by hand and convert it.",
    conversionFailed: "Conversion failed",
    uploading: (percent: number) => `Uploading ${percent}%`,
    converting: "Converting…",
    cancel: "Cancel",
    convert: "Convert to GIF",
  },

  language: {
    label: "Language",
  },

  units: {
    b: "B",
    kb: "KB",
    mb: "MB",
    px: "px",
    seconds: "s",
  },

  filePicker: {
    chooseAnother: "Choose another video",
    dropTitle: "Drop a video here or click to choose one",
    formats: "MP4, MOV, WebM and other formats FFmpeg can read",
  },

  trim: {
    title: "Trim",
    gifLength: (time: string) => `GIF length ${time}`,
    start: "Start",
    end: "End",
    useCurrentFrame: "Use current frame",
    endOfVideo: "end of video",
    videoLength: (time: string) =>
      `Video length ${time}. Playback loops over the selected range.`,
  },

  text: {
    title: "Text",
    remove: "Remove",
    caption: "Caption",
    captionPlaceholder: "Optional. Line breaks are kept.",
    position: "Position",
    positionGroup: "Text position",
    positions: {
      "top-left": "top left",
      top: "top",
      "top-right": "top right",
      center: "center",
      "bottom-left": "bottom left",
      bottom: "bottom",
      "bottom-right": "bottom right",
    } satisfies Record<TextPosition, string>,
    fontSize: "Font size",
    color: "Color",
    outline: "Outline",
    outlineColor: "Outline color",
    backgroundBox: "Background box",
    boxColor: "Box color",
    opacity: (percent: number) => `Opacity ${percent}%`,
    showFrom: "Show from",
    hideAt: "Hide at",
    startPlaceholder: "start",
    endPlaceholder: "end",
    note: "Times count from the start of the GIF. Sizes are in GIF pixels. The preview is approximate.",
  },

  compression: {
    title: "Quality and size",
    modePreset: "Preset",
    modeTarget: "Target size",
    maxSize: "Maximum GIF size",
    targetNote:
      "The preset below is the starting point. Colors, frame rate and then width are lowered until the GIF fits.",
    presetGroup: "Compression preset",
    presets: {
      high: { title: "High", note: "Best quality, biggest file" },
      medium: { title: "Medium", note: "Balanced" },
      low: { title: "Low", note: "Smallest file" },
    } satisfies Record<Preset, { title: string; note: string }>,
    fineTune: "Fine-tune",
    custom: "custom",
    leaveEmpty: "Leave a field empty to use the preset's value.",
    fps: "FPS",
    width: "Width",
    colors: "Colors",
    lossy: "Lossy",
    reset: "Reset to preset",
  },

  summary: {
    fps: (fps: number) => `${fps} fps`,
    colors: (colors: number) => `${colors} ${plural.select(colors) === "one" ? "color" : "colors"}`,
    lossy: (level: number) => `lossy ${level}`,
  },

  estimate: {
    title: "Estimated size",
    cantReachSize: "Can't reach this size",
    cantEstimate: "Can't estimate the size",
    fromSamples: "from samples",
    estimating: "Estimating",
  },

  result: {
    title: "Your GIF",
    close: "Close",
    imageAlt: "Converted GIF",
    madeIn: (seconds: string) => `made in ${seconds} s`,
    download: (filename: string) => `Download ${filename}`,
  },

  errors: {
    tooLarge: "The video is too large for the server.",
    unreachable: "Could not reach the server. Is the backend running?",
    http: (status: number) => `The server responded with an error (HTTP ${status}).`,
  },

  validation: {
    startNegative: "Start must be 0 or later.",
    startAfterVideo: "Start must be before the end of the video.",
    endBeforeStart: "End must be after the start.",
    endAfterVideo: "End is past the end of the video.",
    textTooLong: (max: number) => `Text must be at most ${max} characters.`,
    fontSize: (min: number, max: number) => `Font size must be between ${min} and ${max}.`,
    outline: (min: number, max: number) => `Outline must be between ${min} and ${max}.`,
    textAfterGif: "Text must appear before the GIF ends.",
    textHiddenBeforeShown: "Text must disappear after it appears.",
    overrideRange: (label: string, min: number, max: number) =>
      `${label} must be between ${min} and ${max}.`,
    overrideLabels: {
      fps: "FPS",
      width: "Width",
      colors: "Colors",
      lossy: "Lossy level",
    },
    targetTooSmall: (min: number) => `Target size must be at least ${min} KB.`,
  },
};

export type Messages = typeof en;
