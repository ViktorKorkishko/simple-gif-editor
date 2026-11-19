/** Thin client for the backend API. */

import type { Preset } from "./settings";

export interface GifSettings {
  fps: number;
  width: number;
  colors: number;
  lossy: number;
  dither?: string;
}

export interface SizeEstimate {
  estimated_bytes: number;
  duration: number;
  exact: boolean;
  settings: GifSettings;
}

export interface ConvertResult {
  blob: Blob;
  filename: string;
  settings: GifSettings | null;
}

export type PresetTable = Record<Preset, GifSettings>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ValidationIssue {
  loc?: (string | number)[];
  msg?: string;
}

/** Turn a FastAPI error body into one readable sentence. */
export function errorMessage(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return (detail as ValidationIssue[])
      .map((issue) => {
        const field = issue.loc?.filter((part) => part !== "body").join(".");
        return field ? `${field}: ${issue.msg}` : (issue.msg ?? "invalid value");
      })
      .join("; ");
  }
  if (status === 413) return "The video is too large for the server.";
  if (status === 0) return "Could not reach the server. Is the backend running?";
  return `The server responded with an error (HTTP ${status}).`;
}

export function buildForm(file: File, fields: Record<string, string>): FormData {
  const form = new FormData();
  form.append("file", file);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return form;
}

/** `attachment; filename="clip.gif"` -> `clip.gif`. */
export function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const encoded = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // Fall through to the plain filename.
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : fallback;
}

export function settingsFromHeaders(get: (name: string) => string | null): GifSettings | null {
  const read = (name: string) => {
    const raw = get(name);
    const value = raw === null || raw === "" ? NaN : Number(raw);
    return Number.isInteger(value) ? value : null;
  };
  const fps = read("X-Gif-Fps");
  const width = read("X-Gif-Width");
  const colors = read("X-Gif-Colors");
  const lossy = read("X-Gif-Lossy");
  if (fps === null || width === null || colors === null || lossy === null) return null;
  return { fps, width, colors, lossy };
}

export interface RequestOptions {
  signal?: AbortSignal;
  /** Called with a 0-1 fraction while the video is being uploaded. */
  onUploadProgress?: (fraction: number) => void;
  /** Called once the upload is done and the server is working. */
  onUploaded?: () => void;
}

/**
 * POST a multipart form. Uses XMLHttpRequest rather than fetch because fetch
 * cannot report upload progress, which matters for large videos.
 */
function postForm(
  url: string,
  form: FormData,
  responseType: "json" | "blob",
  { signal, onUploadProgress, onUploaded }: RequestOptions,
): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = responseType;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onUploadProgress?.(event.loaded / event.total);
    };
    xhr.upload.onload = () => onUploaded?.();
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr);
        return;
      }
      let body: unknown = xhr.response;
      if (body instanceof Blob) {
        try {
          body = JSON.parse(await body.text());
        } catch {
          body = null;
        }
      }
      reject(new ApiError(errorMessage(xhr.status, body), xhr.status));
    };
    xhr.onerror = () => reject(new ApiError(errorMessage(0, null), 0));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

export async function estimateSize(
  file: File,
  fields: Record<string, string>,
  options: RequestOptions = {},
): Promise<SizeEstimate> {
  const xhr = await postForm("/api/estimate", buildForm(file, fields), "json", options);
  return xhr.response as SizeEstimate;
}

export async function convertVideo(
  file: File,
  fields: Record<string, string>,
  options: RequestOptions = {},
): Promise<ConvertResult> {
  const xhr = await postForm("/api/convert", buildForm(file, fields), "blob", options);
  const stem = file.name.replace(/\.[^.]+$/, "") || "video";
  return {
    blob: xhr.response as Blob,
    filename: filenameFromDisposition(xhr.getResponseHeader("Content-Disposition"), `${stem}.gif`),
    settings: settingsFromHeaders((name) => xhr.getResponseHeader(name)),
  };
}

export async function fetchPresets(signal?: AbortSignal): Promise<PresetTable> {
  const response = await fetch("/api/presets", { signal });
  if (!response.ok) throw new ApiError(errorMessage(response.status, null), response.status);
  return (await response.json()) as PresetTable;
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
