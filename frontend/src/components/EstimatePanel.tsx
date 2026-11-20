import { SettingsSummary } from "./SettingsSummary";
import type { EstimateState } from "../hooks/useEstimate";
import { useI18n } from "../i18n/I18nProvider";
import { describeError } from "../lib/api";
import { formatBytes } from "../lib/format";

interface Props {
  state: EstimateState;
  targetMode: boolean;
}

export function EstimatePanel({ state, targetMode }: Props) {
  const { t } = useI18n();
  if (state.status === "idle") return null;

  if (state.status === "error") {
    return (
      <div className="estimate error" role="alert">
        <strong>{targetMode ? t.estimate.cantReachSize : t.estimate.cantEstimate}</strong>
        <span>{describeError(state.error, t.errors)}</span>
      </div>
    );
  }

  const estimate = state.status === "done" ? state.estimate : state.previous;
  const loading = state.status === "loading";

  return (
    <div className={`estimate${loading ? " stale" : ""}`} aria-live="polite">
      <span className="muted small">{t.estimate.title}</span>
      {estimate ? (
        <>
          <strong className="estimate-size">
            {estimate.exact ? "" : "≈ "}
            {formatBytes(estimate.estimated_bytes, t.units)}
          </strong>
          <span className="muted small">
            <SettingsSummary settings={estimate.settings} />
            {!estimate.exact && ` · ${t.estimate.fromSamples}`}
          </span>
        </>
      ) : (
        <strong className="estimate-size">…</strong>
      )}
      {loading && <span className="spinner small" aria-label={t.estimate.estimating} />}
    </div>
  );
}
