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
) -> FileResponse:
    try:
        trim = TrimRange(start=start or 0.0, end=end, duration=duration)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    workdir = Path(tempfile.mkdtemp(prefix="gif-"))
    cleanup = BackgroundTask(shutil.rmtree, workdir, ignore_errors=True)
    try:
        src = workdir / "input"
        _save_upload(file, src)
        if not trim.is_full:
            _check_trim_fits(src, trim)
        dst = convert_to_gif(src, workdir / "output.gif", GifOptions(fps=fps, width=width), trim)
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
