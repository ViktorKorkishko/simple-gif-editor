import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExportMenu, type ConvertState } from "./components/ExportMenu";
import { FilePicker } from "./components/FilePicker";
import { DownloadIcon, FilmIcon, LogoMark } from "./components/Icons";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { PlayerControls } from "./components/PlayerControls";
import { CAPTION_INPUT_ID, TextPanel } from "./components/TextPanel";
import { Timeline } from "./components/Timeline";
import { VideoPreview, type VideoMetadata, type VideoPreviewHandle } from "./components/VideoPreview";
import { useEstimate } from "./hooks/useEstimate";
import { useObjectUrl } from "./hooks/useObjectUrl";
import { useI18n } from "./i18n/I18nProvider";
import { convertVideo, fetchPresets, isAbort, type ConvertResult, type PresetTable } from "./lib/api";
import { formatBytes, formatTimecode } from "./lib/format";
import {
  DEFAULT_SETTINGS,
  DEFAULT_WIDTH,
  clipLength,
  newTextLayer,
  toFormFields,
  validate,
  type EditorSettings,
  type TextLayer,
} from "./lib/settings";

/** The player's frame buttons step by one frame of 30 fps video. */
const FRAME_STEP = 1 / 30;

export default function App() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [unplayable, setUnplayable] = useState(false);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_SETTINGS);
  const [selectedText, setSelectedText] = useState<string | null>(DEFAULT_SETTINGS.texts[0]?.id ?? null);
  const [presets, setPresets] = useState<PresetTable | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [convertState, setConvertState] = useState<ConvertState>({ status: "idle" });
  const [result, setResult] = useState<{ result: ConvertResult; elapsedMs: number } | null>(null);
  const conversion = useRef<AbortController | null>(null);
  const preview = useRef<VideoPreviewHandle>(null);
  const exportButton = useRef<HTMLButtonElement>(null);
  const videoUrl = useObjectUrl(file);
  const duration = metadata?.duration ?? null;

  useEffect(() => {
    const controller = new AbortController();
    fetchPresets(controller.signal)
      .then(setPresets)
      .catch(() => {
        // The quality cards just show no numbers; converting still works.
      });
    return () => controller.abort();
  }, []);

  const update = useCallback(
    (patch: Partial<EditorSettings>) => setSettings((current) => ({ ...current, ...patch })),
    [],
  );

  const chooseFile = (next: File) => {
    conversion.current?.abort();
    setFile(next);
    setMetadata(null);
    setUnplayable(false);
    setTime(0);
    setPlaying(false);
    setResult(null);
    setConvertState({ status: "idle" });
    setSettings((current) => ({
      ...current,
      start: 0,
      end: null,
      texts: current.texts.map((layer) => ({ ...layer, start: null, end: null })),
    }));
  };

  const focusCaption = () => requestAnimationFrame(() => document.getElementById(CAPTION_INPUT_ID)?.focus());
  const addText = () => {
    const layer = newTextLayer();
    setSettings((current) => ({ ...current, texts: [...current.texts, layer] }));
    setSelectedText(layer.id);
    focusCaption();
  };
  const removeText = (id: string) => {
    const index = settings.texts.findIndex((layer) => layer.id === id);
    const rest = settings.texts.filter((layer) => layer.id !== id);
    update({ texts: rest });
    if (selectedText === id) setSelectedText(rest[Math.min(index, rest.length - 1)]?.id ?? null);
  };
  const changeText = (id: string, patch: Partial<TextLayer>) =>
    setSettings((current) => ({
      ...current,
      texts: current.texts.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
    }));

  const closeExport = useCallback(() => {
    setExportOpen(false);
    exportButton.current?.focus();
  }, []);

  const errors = useMemo(
    () => validate(settings, duration, t.validation),
    [settings, duration, t],
  );
  const fields = useMemo(() => toFormFields(settings, duration), [settings, duration]);
  // Wait for the video's duration so the trim range is checked before uploading.
  const ready = file !== null && (duration !== null || unplayable);
  const busy = convertState.status === "uploading" || convertState.status === "converting";
  // Estimating uploads the video, so only do it while the export menu is open.
  const estimate = useEstimate(file, fields, exportOpen && !result && ready && errors.length === 0);

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

  const seek = (seconds: number) => preview.current?.seek(seconds);
  const fileInfo = file && [
    duration !== null ? formatTimecode(duration) : null,
    metadata && metadata.width > 0 ? `${metadata.width} × ${metadata.height}` : null,
    formatBytes(file.size, t.units),
  ];

  return (
    <div className={`app${file ? " has-file" : ""}`}>
      <header className="app-header">
        <div className="header-start">
          <div className="brand">
            <LogoMark />
            <h1>{t.app.title}</h1>
          </div>
          {file && (
            <>
              <div className="header-divider" aria-hidden />
              <div className="file-info">
                <FilmIcon size={18} />
                <span className="file-name" title={file.name}>
                  {file.name}
                </span>
                <span className="file-meta mono">{fileInfo?.filter(Boolean).join(" · ")}</span>
                <FilePicker onFile={chooseFile} compact />
              </div>
            </>
          )}
        </div>
        <div className="header-end">
          <LanguageSwitcher />
          <div className="export-anchor">
            <button
              ref={exportButton}
              type="button"
              className="button primary"
              aria-expanded={exportOpen}
              aria-haspopup="dialog"
              disabled={!file}
              onClick={() => setExportOpen((open) => !open)}
            >
              <DownloadIcon size={18} />
              <span>{t.header.export}</span>
              {(busy || result) && <span className="export-dot" aria-hidden />}
            </button>
            {exportOpen && file && (
              <ExportMenu
                settings={settings}
                presets={presets}
                onChange={update}
                estimate={estimate}
                videoSize={metadata && metadata.width > 0 ? metadata : null}
                clipLength={clipLength(settings, duration)}
                errors={errors}
                canConvert={ready && errors.length === 0}
                convertState={convertState}
                onConvert={convert}
                onCancel={() => conversion.current?.abort()}
                result={result}
                onDismissResult={() => setResult(null)}
                onClose={closeExport}
              />
            )}
          </div>
        </div>
      </header>

      {exportOpen && file && (
        <button
          type="button"
          className="backdrop"
          aria-label={t.exporter.closeMenu}
          tabIndex={-1}
          onClick={closeExport}
        />
      )}

      {!file || !videoUrl ? (
        <main className="empty">
          <FilePicker onFile={chooseFile} />
        </main>
      ) : (
        <>
          <div className="workspace">
            <main className="stage-column">
              <div className="stage">
                {unplayable ? (
                  <div className="notice">{t.app.unplayable}</div>
                ) : (
                  <VideoPreview
                    ref={preview}
                    src={videoUrl}
                    settings={settings}
                    gifWidth={gifWidth}
                    onMetadata={setMetadata}
                    onTime={setTime}
                    onPlayingChange={setPlaying}
                    onUnplayable={() => setUnplayable(true)}
                  />
                )}
              </div>
              <PlayerControls
                time={time}
                duration={duration}
                playing={playing}
                disabled={unplayable || duration === null}
                onTogglePlay={() => preview.current?.togglePlay()}
                onStep={(direction) => preview.current?.step(direction * FRAME_STEP)}
              />
            </main>

            <aside className="sidebar">
              <TextPanel
                texts={settings.texts}
                selectedId={selectedText}
                onSelect={setSelectedText}
                onAdd={addText}
                onRemove={removeText}
                onChange={changeText}
              />
            </aside>
          </div>

          <Timeline
            settings={settings}
            duration={duration}
            time={time}
            onChange={update}
            onSeek={seek}
            selectedText={selectedText}
            onTextClick={(id) => {
              setSelectedText(id);
              focusCaption();
            }}
          />
        </>
      )}
    </div>
  );
}
