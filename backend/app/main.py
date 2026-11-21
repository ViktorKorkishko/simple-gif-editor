"""HTTP API."""

import logging
import shutil
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.background import BackgroundTask
from starlette.responses import Response
from starlette.types import Scope

from app.compression import PRESETS, CompressionPreset, resolve_options
from app.config import settings
from app.converter import (
    MAX_COLORS,
    MAX_FPS,
    MAX_LOSSY,
    MAX_WIDTH,
    MIN_COLORS,
    MIN_FPS,
    MIN_LOSSY,
    MIN_WIDTH,
    ConversionError,
    GifOptions,
    OutputFormat,
    TrimRange,
    convert_video,
)
from app.effects import Effect, parse_effects
from app.estimate import (
    Clip,
    TargetUnreachableError,
    convert_to_target,
    estimate_size,
    fit_to_target,
)
from app.limits import FORM_OVERHEAD_BYTES, BodySizeLimitMiddleware, JobSlots
from app.overlay import (
    MAX_FONT_SIZE,
    MAX_OFFSET,
    MAX_OUTLINE,
    MAX_TEXT_LENGTH,
    MIN_FONT_SIZE,
    TextOverlay,
    TextPosition,
    parse_text_layers,
)
from app.probe import ProbeError, probe_duration
from app.workdirs import new_workdir, remove_stale_workdirs

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    removed = remove_stale_workdirs()
    if removed:
        logger.info("Removed %d stale work directories", removed)
    yield


app = FastAPI(title="Simple GIF Editor", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    BodySizeLimitMiddleware,
    max_bytes=lambda: settings.max_upload_bytes + FORM_OVERHEAD_BYTES,
)

job_slots = JobSlots(settings.max_concurrent_jobs)

CHUNK = 1024 * 1024
MIN_TARGET_KB = 10
# Container durations are not exact, so a clip a few ms over the limit passes.
CLIP_TOLERANCE_S = 0.05


class GifSettings(BaseModel):
    fps: int
    width: int
    colors: int
    lossy: int
    dither: str

    @classmethod
    def of(cls, options: GifOptions) -> "GifSettings":
        return cls(
            fps=options.fps,
            width=options.width,
            colors=options.colors,
            lossy=options.lossy,
            dither=options.dither.value,
        )


class SizeEstimateResponse(BaseModel):
    estimated_bytes: int
    duration: float
    exact: bool
    settings: GifSettings


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@dataclass(frozen=True)
class ConversionParams:
    """Everything about a conversion except the uploaded file."""

    options: GifOptions
    trim: TrimRange
    overlays: tuple[TextOverlay, ...]
    effects: tuple[Effect, ...]
    target_bytes: int | None


def conversion_params(
    format: Annotated[
        OutputFormat,
        Form(description="Output format. colors applies only to GIF; lossy to every format"),
    ] = OutputFormat.GIF,
    preset: Annotated[
        CompressionPreset | None,
        Form(description="Compression preset; fps, width, colors and lossy override it"),
    ] = None,
    fps: Annotated[
        int | None, Form(ge=MIN_FPS, le=MAX_FPS, description="Frames per second (default 10)")
    ] = None,
    width: Annotated[
        int | None,
        Form(
            ge=MIN_WIDTH,
            le=MAX_WIDTH,
            description="Width in px; height keeps the aspect ratio (default 480)",
        ),
    ] = None,
    colors: Annotated[
        int | None,
        Form(ge=MIN_COLORS, le=MAX_COLORS, description="Palette size (default 256)"),
    ] = None,
    lossy: Annotated[
        int | None,
        Form(
            ge=MIN_LOSSY,
            le=MAX_LOSSY,
            description=(
                "Compression level, 0 for none (default 0): gifsicle's lossy level for GIF, "
                "lower quality for WebP and MP4"
            ),
        ),
    ] = None,
    target_size_kb: Annotated[
        int | None,
        Form(
            ge=MIN_TARGET_KB,
            description="Largest allowed file size in KB; settings are lowered until it fits",
        ),
    ] = None,
    start: Annotated[
        float | None, Form(ge=0, description="Where the GIF starts, in seconds")
    ] = None,
    end: Annotated[
        float | None,
        Form(gt=0, description="Where the GIF ends, in seconds. Mutually exclusive with duration"),
    ] = None,
    duration: Annotated[
        float | None,
        Form(gt=0, description="Length of the GIF, in seconds. Mutually exclusive with end"),
    ] = None,
    text: Annotated[
        str | None,
        Form(
            max_length=MAX_TEXT_LENGTH,
            description="Caption to draw on the GIF. The other text_* fields apply only with it",
        ),
    ] = None,
    text_size: Annotated[
        int, Form(ge=MIN_FONT_SIZE, le=MAX_FONT_SIZE, description="Font size in GIF pixels")
    ] = 32,
    text_color: Annotated[
        str, Form(description="Colour name or #RRGGBB[AA], optionally with @opacity")
    ] = "white",
    text_position: Annotated[
        TextPosition, Form(description="Where to place the text; ignored when x/y are set")
    ] = TextPosition.BOTTOM,
    text_x: Annotated[
        int | None,
        Form(ge=0, le=MAX_OFFSET, description="Left edge of the text in px; needs text_y"),
    ] = None,
    text_y: Annotated[
        int | None,
        Form(ge=0, le=MAX_OFFSET, description="Top edge of the text in px; needs text_x"),
    ] = None,
    text_outline: Annotated[
        int, Form(ge=0, le=MAX_OUTLINE, description="Outline width in px, 0 for none")
    ] = 2,
    text_outline_color: Annotated[str, Form(description="Outline colour")] = "black",
    text_box: Annotated[bool, Form(description="Draw a background box behind the text")] = False,
    text_box_color: Annotated[
        str, Form(description="Background box colour, e.g. black@0.5")
    ] = "black@0.5",
    text_start: Annotated[
        float | None,
        Form(ge=0, description="When the text appears, in seconds from the start of the GIF"),
    ] = None,
    text_end: Annotated[
        float | None,
        Form(gt=0, description="When the text disappears, in seconds from the start of the GIF"),
    ] = None,
    texts: Annotated[
        str | None,
        Form(
            description=(
                "Several captions as a JSON array of objects with the keys text, size, color, "
                "position, x, y, outline, outline_color, box, box_color, start and end (same "
                "meaning as the text_* fields). Drawn after the text field, the last on top"
            ),
        ),
    ] = None,
    effects: Annotated[
        str | None,
        Form(
            description=(
                "Video effects as a JSON array of objects with type (grayscale, sepia, blur, "
                "brightness, contrast, saturation), amount (0-100, default 100) and optional "
                "start and end in seconds from the start of the output. Applied in order, "
                "under the text"
            ),
        ),
    ] = None,
) -> ConversionParams:
    try:
        options = resolve_options(
            preset, fps=fps, width=width, colors=colors, lossy=lossy, format=format
        )
        trim = TrimRange(start=start or 0.0, end=end, duration=duration)
        overlays: list[TextOverlay] = []
        if text and text.strip():
            single = TextOverlay(
                text=text,
                font_size=text_size,
                color=text_color,
                position=text_position,
                x=text_x,
                y=text_y,
                outline=text_outline,
                outline_color=text_outline_color,
                box=text_box,
                box_color=text_box_color,
                start=text_start,
                end=text_end,
            )
            overlays.append(single)
        if texts:
            overlays += parse_text_layers(texts)
        effect_list = parse_effects(effects) if effects else []
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return ConversionParams(
        options=options,
        trim=trim,
        overlays=tuple(overlays),
        effects=tuple(effect_list),
        target_bytes=None if target_size_kb is None else target_size_kb * 1024,
    )


Params = Annotated[ConversionParams, Depends(conversion_params)]
Video = Annotated[UploadFile, File(description="Video file (mp4, mov, webm, ...)")]


@app.get("/api/presets")
def list_presets() -> dict[str, GifSettings]:
    """Settings behind each compression preset."""
    return {preset.value: GifSettings.of(options) for preset, options in PRESETS.items()}


@app.post(
    "/api/convert",
    response_class=FileResponse,
    responses={200: {"content": {"image/gif": {}, "image/webp": {}, "video/mp4": {}}}},
)
def convert(file: Video, params: Params) -> FileResponse:
    """Convert a video to GIF, WebP or MP4.

    The settings actually used are returned in the ``X-Gif-*`` headers, which
    matters in target size mode.
    """
    workdir = new_workdir()
    cleanup = BackgroundTask(shutil.rmtree, workdir, ignore_errors=True)
    output_format = params.options.format
    dst = workdir / f"output.{output_format.extension}"
    try:
        src = workdir / "input"
        _save_upload(file, src)
        options = params.options
        with job_slots.slot(settings.job_wait_s):
            clip = _clip(src, params)
            if params.target_bytes is not None:
                options = convert_to_target(clip, options, params.target_bytes, workdir, dst)
            else:
                convert_video(src, dst, options, params.trim, params.overlays, params.effects)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except TargetUnreachableError as exc:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ConversionError as exc:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=f"Could not convert video: {exc}") from exc

    stem = Path(file.filename or "video").stem or "video"
    return FileResponse(
        dst,
        media_type=output_format.media_type,
        filename=f"{stem}.{output_format.extension}",
        headers=_settings_headers(options),
        background=cleanup,
    )


@app.post("/api/estimate")
def estimate(file: Video, params: Params) -> SizeEstimateResponse:
    """Predict the file size for these settings without returning the file.

    With ``target_size_kb``, returns the settings that would be chosen to fit it.
    Long clips are sampled, so the size is approximate unless ``exact`` is true.
    """
    workdir = new_workdir()
    try:
        src = workdir / "input"
        _save_upload(file, src)
        with job_slots.slot(settings.job_wait_s):
            clip = _clip(src, params)
            if params.target_bytes is not None:
                result = fit_to_target(clip, params.options, params.target_bytes, workdir)
            else:
                result = estimate_size(clip, params.options, workdir)
    except TargetUnreachableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ConversionError as exc:
        raise HTTPException(status_code=422, detail=f"Could not convert video: {exc}") from exc
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
    return SizeEstimateResponse(
        estimated_bytes=result.bytes,
        duration=round(result.duration, 3),
        exact=result.exact,
        settings=GifSettings.of(result.options),
    )


def _clip(src: Path, params: ConversionParams) -> Clip:
    """Check the trim range and clip length against the video and describe the clip."""
    try:
        video_duration = probe_duration(src)
    except ProbeError as exc:
        raise HTTPException(status_code=422, detail=f"Could not read video: {exc}") from exc
    try:
        params.trim.check_within(video_duration)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    clip = Clip.from_trim(src, params.trim, video_duration, params.overlays, params.effects)
    limit = settings.max_clip_seconds
    if limit > 0 and clip.length > limit + CLIP_TOLERANCE_S:
        raise HTTPException(
            status_code=422,
            detail=(
                f"The clip would be {clip.length:.1f} s long, the limit is {limit:g} s. "
                "Choose a shorter part of the video"
            ),
        )
    return clip


def _settings_headers(options: GifOptions) -> dict[str, str]:
    return {
        "X-Gif-Fps": str(options.fps),
        "X-Gif-Width": str(options.width),
        "X-Gif-Colors": str(options.colors),
        "X-Gif-Lossy": str(options.lossy),
    }


def _save_upload(upload: UploadFile, dst: Path) -> None:
    written = 0
    with dst.open("wb") as out:
        while chunk := upload.file.read(CHUNK):
            written += len(chunk)
            if written > settings.max_upload_bytes:
                raise HTTPException(
                    status_code=413,
                    detail=f"File is larger than {settings.max_upload_mb} MB",
                )
            out.write(chunk)
    if written == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")


IMMUTABLE = "public, max-age=31536000, immutable"


class FrontendFiles(StaticFiles):
    """Static files with cache headers that suit a Vite build.

    Files under ``assets/`` have content hashes in their names and never
    change, so browsers may keep them for a year. Everything else, notably
    ``index.html``, must be revalidated so a new deploy shows up at once.
    """

    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        if response.status_code in (200, 304):
            response.headers["Cache-Control"] = (
                IMMUTABLE if path.startswith("assets/") else "no-cache"
            )
        return response


def mount_frontend(target: FastAPI, directory: Path | None) -> None:
    """Serve the built web UI from ``directory`` at ``/``, after the API routes."""
    if directory is None:
        return
    if not directory.is_dir():
        raise RuntimeError(f"FRONTEND_DIR {directory} is not a directory")
    target.mount("/", FrontendFiles(directory=directory, html=True), name="frontend")


mount_frontend(app, settings.frontend_dir)
