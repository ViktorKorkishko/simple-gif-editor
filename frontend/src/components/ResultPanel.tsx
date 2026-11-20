import { SettingsSummary } from "./SettingsSummary";
import type { ConvertResult } from "../lib/api";
import { useObjectUrl } from "../hooks/useObjectUrl";
import { useI18n } from "../i18n/I18nProvider";
import { formatBytes } from "../lib/format";

interface Props {
  result: ConvertResult;
  elapsedMs: number;
  onDismiss: () => void;
}

export function ResultPanel({ result, elapsedMs, onDismiss }: Props) {
  const { t } = useI18n();
  const url = useObjectUrl(result.blob);
  if (!url) return null;

  return (
    <section className="panel result">
      <div className="panel-header">
        <h2>{t.result.title}</h2>
        <button type="button" className="link" onClick={onDismiss}>
          {t.result.close}
        </button>
      </div>
      <div className="result-image">
        <img src={url} alt={t.result.imageAlt} />
      </div>
      <div className="result-footer">
        <div>
          <strong>{formatBytes(result.blob.size, t.units)}</strong>
          <span className="muted small">
            {result.settings && (
              <>
                {" · "}
                <SettingsSummary settings={result.settings} />
              </>
            )}
            {` · ${t.result.madeIn((elapsedMs / 1000).toFixed(1))}`}
          </span>
        </div>
        <a className="button" href={url} download={result.filename}>
          {t.result.download(result.filename)}
        </a>
      </div>
    </section>
  );
}
