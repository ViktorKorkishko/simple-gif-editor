import { SettingsSummary } from "./SettingsSummary";
import type { ConvertResult } from "../lib/api";
import { useObjectUrl } from "../hooks/useObjectUrl";
import { formatBytes } from "../lib/format";

interface Props {
  result: ConvertResult;
  elapsedMs: number;
  onDismiss: () => void;
}

export function ResultPanel({ result, elapsedMs, onDismiss }: Props) {
  const url = useObjectUrl(result.blob);
  if (!url) return null;

  return (
    <section className="panel result">
      <div className="panel-header">
        <h2>Your GIF</h2>
        <button type="button" className="link" onClick={onDismiss}>
          Close
        </button>
      </div>
      <div className="result-image">
        <img src={url} alt="Converted GIF" />
      </div>
      <div className="result-footer">
        <div>
          <strong>{formatBytes(result.blob.size)}</strong>
          <span className="muted small">
            {result.settings && (
              <>
                {" · "}
                <SettingsSummary settings={result.settings} />
              </>
            )}
            {` · made in ${(elapsedMs / 1000).toFixed(1)} s`}
          </span>
        </div>
        <a className="button" href={url} download={result.filename}>
          Download {result.filename}
        </a>
      </div>
    </section>
  );
}
