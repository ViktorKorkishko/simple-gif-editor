import { SettingsSummary } from "./SettingsSummary";
import type { EstimateState } from "../hooks/useEstimate";
import { formatBytes } from "../lib/format";

interface Props {
  state: EstimateState;
  targetMode: boolean;
}

export function EstimatePanel({ state, targetMode }: Props) {
  if (state.status === "idle") return null;

  if (state.status === "error") {
    return (
      <div className="estimate error" role="alert">
        <strong>{targetMode ? "Can't reach this size" : "Can't estimate the size"}</strong>
        <span>{state.message}</span>
      </div>
    );
  }

  const estimate = state.status === "done" ? state.estimate : state.previous;
  const loading = state.status === "loading";

  return (
    <div className={`estimate${loading ? " stale" : ""}`} aria-live="polite">
      <span className="muted small">Estimated size</span>
      {estimate ? (
        <>
          <strong className="estimate-size">
            {estimate.exact ? "" : "≈ "}
            {formatBytes(estimate.estimated_bytes)}
          </strong>
          <span className="muted small">
            <SettingsSummary settings={estimate.settings} />
            {!estimate.exact && " · from samples"}
          </span>
        </>
      ) : (
        <strong className="estimate-size">…</strong>
      )}
      {loading && <span className="spinner small" aria-label="Estimating" />}
    </div>
  );
}
