/** English UI text. Every other language must provide the same keys. */

import type { OutputFormat, TextPosition, Preset } from "../lib/settings";

const plural = new Intl.PluralRules("en");

export const en = {
  app: {
    title: "Simple GIF Editor",
    unplayable:
      "Your browser can't play this format, so there is no preview. You can still set the clip range by hand and export it.",
  },

  header: {
    replaceVideo: "Replace video",
    export: "Export",
  },

  language: {
    label: "Interface language",
  },

  units: {
    b: "B",
    kb: "KB",
    mb: "MB",
    px: "px",
    seconds: "s",
  },

  filePicker: {
    dropTitle: "Drop a video here or click to choose one",
    formats: "MP4, MOV, WebM and other formats FFmpeg can read",
    choose: "Choose video",
  },

  player: {
    previousFrame: "Previous frame",
    nextFrame: "Next frame",
    play: "Play",
    pause: "Pause",
  },

  timeline: {
    label: "Timeline",
    setStart: "Start here",
    setEnd: "End here",
    clip: "Clip",
    clipStart: "Clip start",
    clipEnd: "Clip end",
    endOfVideo: "end",
    scrub: "Pick a frame on the timeline",
    video: "Video",
    text: "Text",
  },

  text: {
    title: "Text",
    caption: "Text",
    captionPlaceholder: "Type a caption to add it to the GIF. Line breaks are kept.",
    remove: "Remove text",
    timeRange: "Time range",
    from: "from",
    to: "to",
    showFrom: "Show from",
    hideAt: "Hide at",
    startPlaceholder: "start",
    endPlaceholder: "end",
    size: "Size",
    color: "Color",
    customColor: "Custom color",
    hexColor: "Color in HEX",
    swatches: {
      white: "White",
      yellow: "Yellow",
      red: "Red",
      blue: "Blue",
      black: "Black",
    },
    position: "Position",
    positionGroup: "Text position",
    positions: {
      "top-left": "Top left",
      top: "Top center",
      "top-right": "Top right",
      center: "Center",
      "bottom-left": "Bottom left",
      bottom: "Bottom center",
      "bottom-right": "Bottom right",
    } satisfies Record<TextPosition, string>,
    outline: "Outline",
    outlineColor: "Outline color",
    backgroundBox: "Background under text",
    boxColor: "Background color",
    opacity: "Opacity",
    note: "Times count from the start of the GIF. Sizes are in GIF pixels. The preview is approximate.",
  },

  exporter: {
    title: "Export",
    close: "Close",
    closeMenu: "Close export menu",
    format: "Format",
    formats: {
      gif: "Works everywhere",
      webp: "Smaller file",
      mp4: "Best quality",
    } satisfies Record<OutputFormat, string>,
    modeGroup: "How to pick the quality",
    modePreset: "Preset",
    modeTarget: "Target size",
    quality: "Quality",
    presets: {
      high: "High",
      medium: "Medium",
      low: "Low",
    } satisfies Record<Preset, string>,
    maxSize: "Maximum file size",
    targetNote:
      "The selected quality is the starting point. Quality, frame rate and then width are lowered until the file fits.",
    width: "Width, px",
    fps: "Frames per second",
    more: "More settings",
    colors: "Colors",
    lossy: "Lossy compression",
    compression: "Compression",
    compressionNote: "Higher values give a smaller file of lower quality.",
    leaveEmpty: "Leave a field empty to use the preset's value.",
    reset: "Reset to preset",
    frameSize: "Frame size",
    frameCount: "Frames",
    estimate: "Predicted file size",
    fromSamples: "estimated from samples",
    estimating: "Estimating",
    cantReachSize: "Can't reach this size",
    cantEstimate: "Can't estimate the size",
    conversionFailed: "Conversion failed",
    uploading: (percent: number) => `Uploading ${percent}%`,
    converting: "Converting…",
    cancel: "Cancel",
    submit: (format: string) => `Export ${format}`,
  },

  result: {
    title: (format: string) => `Your ${format}`,
    back: "Back to settings",
    imageAlt: "Converted file",
    madeIn: (seconds: string) => `made in ${seconds} s`,
    download: "Download",
  },

  summary: {
    fps: (fps: number) => `${fps} fps`,
    colors: (colors: number) => `${colors} ${plural.select(colors) === "one" ? "color" : "colors"}`,
    lossy: (level: number) => `lossy ${level}`,
    compression: (level: number) => `compression ${level}`,
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
