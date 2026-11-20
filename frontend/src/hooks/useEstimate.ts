import { useEffect, useState } from "react";
import { estimateSize, isAbort, type SizeEstimate } from "../lib/api";

export type EstimateState =
  | { status: "idle" }
  | { status: "loading"; previous: SizeEstimate | null }
  | { status: "done"; estimate: SizeEstimate }
  | { status: "error"; error: unknown };

const DEBOUNCE_MS = 800;

/**
 * Ask the backend for a size estimate whenever the file or settings change.
 * Requests are debounced so dragging a slider does not upload the video on
 * every step, and a newer request cancels the one in flight.
 */
export function useEstimate(
  file: File | null,
  fields: Record<string, string>,
  enabled: boolean,
): EstimateState {
  const [state, setState] = useState<EstimateState>({ status: "idle" });
  const key = JSON.stringify(fields);

  useEffect(() => {
    if (!file || !enabled) {
      setState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setState((current) => ({
      status: "loading",
      previous:
        current.status === "done"
          ? current.estimate
          : current.status === "loading"
            ? current.previous
            : null,
    }));
    const timer = window.setTimeout(() => {
      estimateSize(file, JSON.parse(key) as Record<string, string>, {
        signal: controller.signal,
      })
        .then((estimate) => setState({ status: "done", estimate }))
        .catch((error: unknown) => {
          if (isAbort(error)) return;
          setState({ status: "error", error });
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [file, key, enabled]);

  return state;
}
