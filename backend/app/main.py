"""HTTP API."""

import shutil
import tempfile
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.config import settings
from app.converter import (
    MAX_FPS,
    MAX_WIDTH,
    MIN_FPS,
    MIN_WIDTH,
    ConversionError,
    GifOptions,
    TrimRange,
    convert_to_gif,
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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post(
    "/api/convert",
    response_class=FileResponse,
    responses={200: {"content": {"image/gif": {}}}},
)
def convert(
    file: Annotated[UploadFile, File(description="Video file (mp4, mov, webm, ...)")],
    fps: Annotated[int, Form(ge=MIN_FPS, le=MAX_FPS)] = 10,
    width: Annotated[int, Form(ge=MIN_WIDTH, le=MAX_WIDTH)] = 480,
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
) -> FileResponse:
    try:
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

    workdir = Path(tempfile.mkdtemp(prefix="gif-"))
    cleanup = BackgroundTask(shutil.rmtree, workdir, ignore_errors=True)
    try:
        src = workdir / "input"
        _save_upload(file, src)
        if not trim.is_full:
            _check_trim_fits(src, trim)
        dst = convert_to_gif(
            src, workdir / "output.gif", GifOptions(fps=fps, width=width), trim, overlay
        )
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except ConversionError as exc:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=f"Could not convert video: {exc}") from exc

    stem = Path(file.filename or "video").stem or "video"
    return FileResponse(dst, media_type="image/gif", filename=f"{stem}.gif", background=cleanup)


def _check_trim_fits(src: Path, trim: TrimRange) -> None:
    try:
        video_duration = probe_duration(src)
    except ProbeError as exc:
        raise HTTPException(status_code=422, detail=f"Could not read video: {exc}") from exc
    try:
        trim.check_within(video_duration)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


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
