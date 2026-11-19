"""HTTP API."""

import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.background import BackgroundTask

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
    TrimRange,
    convert_to_gif,
)
from app.estimate import (
    Clip,
    TargetUnreachableError,
    convert_to_target,
    estimate_size,
    fit_to_target,
)
from app.overlay import (
    MAX_FONT_SIZE,
    MAX_OFFSET,
    MAX_OUTLINE,
    MAX_TEXT_LENGTH,
    MIN_FONT_SIZE,
    TextOverlay,
    TextPosition,
)
from app.probe import ProbeError, probe_duration

app = FastAPI(title="Simple GIF Editor", version="0.1.0")

CHUNK = 1024 * 1024
MIN_TARGET_KB = 10


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
    overlay: TextOverlay | None
    target_bytes: int | None


def conversion_params(
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
            ge=MIN_LOSSY, le=MAX_LOSSY, description="gifsicle lossy level, 0 for none (default 0)"
        ),
    ] = None,
    target_size_kb: Annotated[
        int | None,
        Form(
            ge=MIN_TARGET_KB,
            description="Largest allowed GIF size in KB; settings are lowered until it fits",
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
) -> ConversionParams:
    try:
        options = resolve_options(preset, fps=fps, width=width, colors=colors, lossy=lossy)
        trim = TrimRange(start=start or 0.0, end=end, duration=duration)
        overlay = None
        if text and text.strip():
            overlay = TextOverlay(
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
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return ConversionParams(
        options=options,
        trim=trim,
        overlay=overlay,
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
    responses={200: {"content": {"image/gif": {}}}},
)
def convert(file: Video, params: Params) -> FileResponse:
    """Convert a video to GIF.

    The settings actually used are returned in the ``X-Gif-*`` headers, which
    matters in target size mode.
    """
    workdir = Path(tempfile.mkdtemp(prefix="gif-"))
    cleanup = BackgroundTask(shutil.rmtree, workdir, ignore_errors=True)
    dst = workdir / "output.gif"
    try:
        src = workdir / "input"
        _save_upload(file, src)
        options = params.options
        if params.target_bytes is not None:
            clip = _clip(src, params)
            options = convert_to_target(clip, options, params.target_bytes, workdir, dst)
        else:
            if not params.trim.is_full:
                _clip(src, params)
            convert_to_gif(src, dst, options, params.trim, params.overlay)
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
        media_type="image/gif",
        filename=f"{stem}.gif",
        headers=_settings_headers(options),
        background=cleanup,
    )


@app.post("/api/estimate")
def estimate(file: Video, params: Params) -> SizeEstimateResponse:
    """Predict the GIF size for these settings without returning the GIF.

    With ``target_size_kb``, returns the settings that would be chosen to fit it.
    Long clips are sampled, so the size is approximate unless ``exact`` is true.
    """
    workdir = Path(tempfile.mkdtemp(prefix="gif-"))
    try:
        src = workdir / "input"
        _save_upload(file, src)
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
    """Check the trim range against the video and describe the clip."""
    try:
        video_duration = probe_duration(src)
    except ProbeError as exc:
        raise HTTPException(status_code=422, detail=f"Could not read video: {exc}") from exc
    try:
        params.trim.check_within(video_duration)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return Clip.from_trim(src, params.trim, video_duration, params.overlay)


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


def mount_frontend(target: FastAPI, directory: Path | None) -> None:
    """Serve the built web UI from ``directory`` at ``/``, after the API routes."""
    if directory is None:
        return
    if not directory.is_dir():
        raise RuntimeError(f"FRONTEND_DIR {directory} is not a directory")
    target.mount("/", StaticFiles(directory=directory, html=True), name="frontend")


mount_frontend(app, settings.frontend_dir)
