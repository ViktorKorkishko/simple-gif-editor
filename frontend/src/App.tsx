import { useEffect, useMemo, useRef, useState } from "react";
import { CompressionPanel } from "./components/CompressionPanel";
import { EstimatePanel } from "./components/EstimatePanel";
import { FilePicker } from "./components/FilePicker";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { ResultPanel } from "./components/ResultPanel";
import { TextPanel } from "./components/TextPanel";
import { TrimPanel } from "./components/TrimPanel";
import { VideoPreview, type VideoPreviewHandle } from "./components/VideoPreview";
import { useEstimate } from "./hooks/useEstimate";
import { useObjectUrl } from "./hooks/useObjectUrl";
import { useI18n } from "./i18n/I18nProvider";
import {
  convertVideo,
  describeError,
  fetchPresets,
  isAbort,
  type ConvertResult,
  type PresetTable,
} from "./lib/api";
import { formatBytes } from "./lib/format";
import {
  DEFAULT_SETTINGS,
  DEFAULT_WIDTH,
  toFormFields,
  validate,
  type EditorSettings,
} from "./lib/settings";

type ConvertState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "converting" }
  | { status: "error"; error: unknown };

export default function App() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [unplayable, setUnplayable] = useState(false);
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_SETTINGS);
  const [presets, setPresets] = useState<PresetTable | null>(null);
  const [convertState, setConvertState] = useState<ConvertState>({ status: "idle" });
  const [result, setResult] = useState<{ result: ConvertResult; elapsedMs: number } | null>(null);
  const conversion = useRef<AbortController | null>(null);
  const preview = useRef<VideoPreviewHandle>(null);
  const videoUrl = useObjectUrl(file);

  useEffect(() => {
    const controller = new AbortController();
    fetchPresets(controller.signal)
      .then(setPresets)
      .catch(() => {
        // The preset cards just show no numbers; converting still works.
      });
    return () => controller.abort();
  }, []);

  const update = (patch: Partial<EditorSettings>) =>
    setSettings((current) => ({ ...current, ...patch }));

  const chooseFile = (next: File) => {
    conversion.current?.abort();
    setFile(next);
    setDuration(null);
    setUnplayable(false);
    setResult(null);
    setConvertState({ status: "idle" });
    setSettings((current) => ({ ...current, start: 0, end: null, textStart: null, textEnd: null }));
  };

  const errors = useMemo(
    () => validate(settings, duration, t.validation),
    [settings, duration, t],
  );
  const fields = useMemo(() => toFormFields(settings, duration), [settings, duration]);
  // Wait for the video's duration so the trim range is checked before uploading.
  const ready = file !== null && (duration !== null || unplayable);
  const busy = convertState.status === "uploading" || convertState.status === "converting";
  const estimate = useEstimate(file, fields, ready && errors.length === 0);

  const gifWidth =
    settings.overrides.width ??
    (settings.mode === "target" && estimate.status === "done"
      ? estimate.estimate.settings.width
      : (presets?.[settings.preset].width ?? DEFAULT_WIDTH));

  const convert = async () => {
    if (!file) return;
    const controller = new AbortController();
    conversion.current = controller;
    const started = performance.now();
    setConvertState({ status: "uploading", progress: 0 });
    try {
      const converted = await convertVideo(file, fields, {
        signal: controller.signal,
        onUploadProgress: (progress) => setConvertState({ status: "uploading", progress }),
        onUploaded: () => setConvertState({ status: "converting" }),
      });
      setResult({ result: converted, elapsedMs: performance.now() - started });
      setConvertState({ status: "idle" });
    } catch (error) {
      if (isAbort(error)) {
        setConvertState({ status: "idle" });
        return;
      }
      setConvertState({ status: "error", error });
    } finally {
      if (conversion.current === controller) conversion.current = null;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>{t.app.title}</h1>
          <p className="muted">{t.app.tagline}</p>
        </div>
        <LanguageSwitcher />
      </header>

      {!file || !videoUrl ? (
        <main className="empty">
          <FilePicker onFile={chooseFile} />
        </main>
      ) : (
        <main className="editor">
          <div className="column">
            <section className="panel">
              <div className="panel-header">
                <h2 className="filename" title={file.name}>
                  {file.name}
                </h2>
                <span className="badge">{formatBytes(file.size, t.units)}</span>
              </div>
              {unplayable ? (
                <div className="notice">{t.app.unplayable}</div>
              ) : (
                <VideoPreview
                  ref={preview}
                  src={videoUrl}
                  settings={settings}
                  gifWidth={gifWidth}
                  onDuration={setDuration}
                  onUnplayable={() => setUnplayable(true)}
                />
              )}
              <FilePicker onFile={chooseFile} compact />
            </section>
            <TrimPanel
              settings={settings}
              duration={duration}
              onChange={update}
              onSeek={(seconds) => preview.current?.seek(seconds)}
              currentTime={() => preview.current?.currentTime() ?? settings.start}
            />
          </div>

          <div className="column">
            <TextPanel settings={settings} onChange={update} />
            <CompressionPanel settings={settings} presets={presets} onChange={update} />

            <section className="panel actions">
              <EstimatePanel state={estimate} targetMode={settings.mode === "target"} />
              {errors.length > 0 && (
                <ul className="problems" role="alert">
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              )}
              {convertState.status === "error" && (
                <div className="estimate error" role="alert">
                  <strong>{t.app.conversionFailed}</strong>
                  <span>{describeError(convertState.error, t.errors)}</span>
                </div>
              )}
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
                  <span className="small">
                    {convertState.status === "uploading"
                      ? t.app.uploading(Math.round(convertState.progress * 100))
                      : t.app.converting}
                  </span>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => conversion.current?.abort()}
                  >
                    {t.app.cancel}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="button primary"
                  disabled={!ready || errors.length > 0}
                  onClick={convert}
                >
                  {t.app.convert}
                </button>
              )}
            </section>
          </div>

          {result && (
            <div className="full">
              <ResultPanel
                result={result.result}
                elapsedMs={result.elapsedMs}
                onDismiss={() => setResult(null)}
              />
            </div>
          )}
        </main>
      )}
    </div>
  );
}
