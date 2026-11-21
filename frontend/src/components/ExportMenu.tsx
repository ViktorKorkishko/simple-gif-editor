import { useEffect, useRef } from "react";
import { BackIcon, CloseIcon, DownloadIcon } from "./Icons";
import { NumberField } from "./NumberField";
import { SettingsSummary } from "./SettingsSummary";
import type { EstimateState } from "../hooks/useEstimate";
import { useObjectUrl } from "../hooks/useObjectUrl";
import { useI18n } from "../i18n/I18nProvider";
import { describeError, type ConvertResult, type GifSettings, type PresetTable } from "../lib/api";
import { formatBytes } from "../lib/format";
import {
  FORMAT_LABELS,
  LIMITS,
  OUTPUT_FORMATS,
  type EditorSettings,
  type Overrides,
  type Preset,
} from "../lib/settings";

export type ConvertState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "converting" }
  | { status: "error"; error: unknown };

interface Props {
  settings: EditorSettings;
  presets: PresetTable | null;
  onChange: (patch: Partial<EditorSettings>) => void;
  estimate: EstimateState;
  /** Width and height of the source video, if the browser could read them. */
  videoSize: { width: number; height: number } | null;
  clipLength: number | null;
  errors: string[];
  canConvert: boolean;
  convertState: ConvertState;
  onConvert: () => void;
  onCancel: () => void;
  result: { result: ConvertResult; elapsedMs: number } | null;
  onDismissResult: () => void;
  onClose: () => void;
}

// Shown smallest first, as cards from left to right.
const QUALITY_ORDER: Preset[] = ["low", "medium", "high"];
const TARGET_CHIPS_KB = [500, 1024, 2048, 5120, 8192];

function ResultView({
  result,
  elapsedMs,
  onBack,
}: {
  result: ConvertResult;
  elapsedMs: number;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const url = useObjectUrl(result.blob);

  return (
    <div className="export-result">
      <div className="result-image">
        {url &&
          (result.format === "mp4" ? (
            <video src={url} aria-label={t.result.imageAlt} autoPlay loop muted playsInline controls />
          ) : (
            <img src={url} alt={t.result.imageAlt} />
          ))}
      </div>
      <div className="summary-box">
        <div className="summary-row">
          <span className="muted">{result.filename}</span>
          <strong className="mono accent-text">{formatBytes(result.blob.size, t.units)}</strong>
        </div>
        <p className="note">
          {result.settings && (
            <>
              <SettingsSummary settings={result.settings} format={result.format} />
              {" · "}
            </>
          )}
          {t.result.madeIn((elapsedMs / 1000).toFixed(1))}
        </p>
      </div>
      <div className="export-footer">
        {url && (
          <a className="button primary large" href={url} download={result.filename}>
            <DownloadIcon size={18} />
            <span>{t.result.download}</span>
          </a>
        )}
        <button type="button" className="button secondary" onClick={onBack}>
          <BackIcon />
          <span>{t.result.back}</span>
        </button>
      </div>
    </div>
  );
}

export function ExportMenu({
  settings,
  presets,
  onChange,
  estimate,
  videoSize,
  clipLength,
  errors,
  canConvert,
  convertState,
  onConvert,
  onCancel,
  result,
  onDismissResult,
  onClose,
}: Props) {
  const { t } = useI18n();
  const panel = useRef<HTMLElement>(null);
  const busy = convertState.status === "uploading" || convertState.status === "converting";
  const isGif = settings.format === "gif";
  const formatLabel = FORMAT_LABELS[settings.format];
  const base = presets?.[settings.preset];
  const overridden = Object.values(settings.overrides).some((value) => value !== null);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setOverride = (key: keyof Overrides, value: number | null) =>
    onChange({ overrides: { ...settings.overrides, [key]: value } });

  // What the GIF will be made with: the server's answer when there is one, else the preset plus overrides.
  const shown: GifSettings | null =
    estimate.status === "done"
      ? estimate.estimate.settings
      : base
        ? {
            fps: settings.overrides.fps ?? base.fps,
            width: settings.overrides.width ?? base.width,
            colors: settings.overrides.colors ?? base.colors,
            lossy: settings.overrides.lossy ?? base.lossy,
          }
        : null;
  const frameHeight =
    shown && videoSize && videoSize.width > 0
      ? Math.round((shown.width * videoSize.height) / videoSize.width)
      : null;
  const frames = shown && clipLength !== null ? Math.max(1, Math.round(clipLength * shown.fps)) : null;
  const sized = estimate.status === "done" ? estimate.estimate : estimate.status === "loading" ? estimate.previous : null;

  return (
    <section
      ref={panel}
      className="export-menu"
      role="dialog"
      aria-labelledby="export-title"
      tabIndex={-1}
    >
      <div className="export-header">
        <h2 id="export-title">
          {result ? t.result.title(FORMAT_LABELS[result.result.format]) : t.exporter.title}
        </h2>
        <button
          type="button"
          className="icon-button ghost"
          aria-label={t.exporter.close}
          title={t.exporter.close}
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      {result ? (
        <ResultView result={result.result} elapsedMs={result.elapsedMs} onBack={onDismissResult} />
      ) : (
        <>
          <fieldset className="export-settings" disabled={busy}>
            <div className="field">
              <span className="field-label" id="format-label">
                {t.exporter.format}
              </span>
              <div className="option-grid" role="radiogroup" aria-labelledby="format-label">
                {OUTPUT_FORMATS.map((format) => (
                  <button
                    key={format}
                    type="button"
                    role="radio"
                    aria-checked={settings.format === format}
                    className="option-card format-card"
                    onClick={() => onChange({ format })}
                  >
                    <span className="option-title mono">{FORMAT_LABELS[format]}</span>
                    <span className="option-meta">{t.exporter.formats[format]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="segmented" role="radiogroup" aria-label={t.exporter.modeGroup}>
              {(["preset", "target"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={settings.mode === mode}
                  onClick={() => onChange({ mode })}
                >
                  {mode === "preset" ? t.exporter.modePreset : t.exporter.modeTarget}
                </button>
              ))}
            </div>

            <div className="field">
              <span className="field-label" id="quality-label">
                {t.exporter.quality}
              </span>
              <div className="option-grid" role="radiogroup" aria-labelledby="quality-label">
                {QUALITY_ORDER.map((preset) => {
                  const values = presets?.[preset];
                  return (
                    <button
                      key={preset}
                      type="button"
                      role="radio"
                      aria-checked={settings.preset === preset}
                      className="option-card"
                      onClick={() => onChange({ preset })}
                    >
                      <span className="option-title">{t.exporter.presets[preset]}</span>
                      {values && (
                        <>
                          <span className="option-meta mono">
                            {values.width} {t.units.px}
                          </span>
                          <span className="option-meta mono">{t.summary.fps(values.fps)}</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {settings.mode === "target" && (
              <div className="field">
                <NumberField
                  label={t.exporter.maxSize}
                  suffix={t.units.kb}
                  min={LIMITS.minTargetKb}
                  step={1}
                  value={settings.targetSizeKb}
                  onChange={(value) => onChange({ targetSizeKb: value })}
                  hint={
                    settings.targetSizeKb && settings.targetSizeKb >= 1024
                      ? `≈ ${(settings.targetSizeKb / 1024).toFixed(2)} ${t.units.mb}`
                      : undefined
                  }
                />
                <div className="chips">
                  {TARGET_CHIPS_KB.map((kb) => (
                    <button
                      key={kb}
                      type="button"
                      className="chip"
                      aria-pressed={settings.targetSizeKb === kb}
                      onClick={() => onChange({ targetSizeKb: kb })}
                    >
                      {kb < 1024 ? `${kb} ${t.units.kb}` : `${kb / 1024} ${t.units.mb}`}
                    </button>
                  ))}
                </div>
                <p className="note">{t.exporter.targetNote}</p>
              </div>
            )}

            <div className="pair">
              <NumberField
                label={t.exporter.width}
                min={LIMITS.width[0]}
                max={LIMITS.width[1]}
                step={1}
                placeholder={base ? String(base.width) : undefined}
                value={settings.overrides.width}
                onChange={(value) => setOverride("width", value)}
              />
              <NumberField
                label={t.exporter.fps}
                min={LIMITS.fps[0]}
                max={LIMITS.fps[1]}
                step={1}
                placeholder={base ? String(base.fps) : undefined}
                value={settings.overrides.fps}
                onChange={(value) => setOverride("fps", value)}
              />
            </div>

            <details className="more" open={settings.overrides.colors !== null || settings.overrides.lossy !== null || undefined}>
              <summary>{t.exporter.more}</summary>
              <div className="pair">
                {isGif && (
                  <NumberField
                    label={t.exporter.colors}
                    min={LIMITS.colors[0]}
                    max={LIMITS.colors[1]}
                    step={1}
                    placeholder={base ? String(base.colors) : undefined}
                    value={settings.overrides.colors}
                    onChange={(value) => setOverride("colors", value)}
                  />
                )}
                <NumberField
                  label={isGif ? t.exporter.lossy : t.exporter.compression}
                  min={LIMITS.lossy[0]}
                  max={LIMITS.lossy[1]}
                  step={1}
                  placeholder={base ? String(base.lossy) : undefined}
                  value={settings.overrides.lossy}
                  onChange={(value) => setOverride("lossy", value)}
                />
              </div>
              <p className="note">
                {isGif ? t.exporter.leaveEmpty : `${t.exporter.compressionNote} ${t.exporter.leaveEmpty}`}
              </p>
            </details>
            {overridden && (
              <button
                type="button"
                className="link"
                onClick={() => onChange({ overrides: { fps: null, width: null, colors: null, lossy: null } })}
              >
                {t.exporter.reset}
              </button>
            )}
          </fieldset>

          {estimate.status === "error" ? (
            <div className="alert" role="alert">
              <strong>{settings.mode === "target" ? t.exporter.cantReachSize : t.exporter.cantEstimate}</strong>
              <span>{describeError(estimate.error, t.errors)}</span>
            </div>
          ) : (
            <div className={`summary-box${estimate.status === "loading" ? " stale" : ""}`} aria-live="polite">
              <div className="summary-row">
                <span className="muted">{t.exporter.frameSize}</span>
                <span className="mono">
                  {shown ? `${shown.width} × ${frameHeight ?? "?"} ${t.units.px}` : "…"}
                </span>
              </div>
              <div className="summary-row">
                <span className="muted">{t.exporter.frameCount}</span>
                <span className="mono">{frames ?? "…"}</span>
              </div>
              <div className="summary-row">
                <span className="muted">{t.exporter.estimate}</span>
                <span className="mono accent-text strong">
                  {estimate.status === "loading" && (
                    <span className="spinner" role="status" aria-label={t.exporter.estimating} />
                  )}
                  {sized ? `${sized.exact ? "" : "≈ "}${formatBytes(sized.estimated_bytes, t.units)}` : "…"}
                </span>
              </div>
              {sized && !sized.exact && <p className="note">{t.exporter.fromSamples}</p>}
            </div>
          )}

          {errors.length > 0 && (
            <ul className="problems" role="alert">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          {convertState.status === "error" && (
            <div className="alert" role="alert">
              <strong>{t.exporter.conversionFailed}</strong>
              <span>{describeError(convertState.error, t.errors)}</span>
            </div>
          )}

          <div className="export-footer">
            {busy ? (
              <div className="progress-row">
                <div className="progress">
                  <div
                    className={`progress-bar${convertState.status === "converting" ? " indeterminate" : ""}`}
                    style={
                      convertState.status === "uploading"
                        ? { width: `${Math.round(convertState.progress * 100)}%` }
                        : undefined
                    }
                  />
                </div>
                <span className="note">
                  {convertState.status === "uploading"
                    ? t.exporter.uploading(Math.round(convertState.progress * 100))
                    : t.exporter.converting}
                </span>
                <button type="button" className="button secondary" onClick={onCancel}>
                  {t.exporter.cancel}
                </button>
              </div>
            ) : (
              <button type="button" className="button primary large" disabled={!canConvert} onClick={onConvert}>
                <DownloadIcon size={18} />
                <span>{t.exporter.submit(formatLabel)}</span>
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
