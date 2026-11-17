"""Read video metadata with ffprobe."""

import math
import subprocess
from pathlib import Path

from app.config import settings


class ProbeError(RuntimeError):
    """ffprobe could not read the file or it has no usable duration."""


def probe_duration(src: Path) -> float:
    """Return the duration of a media file in seconds."""
    command = [
        settings.ffprobe_bin,
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(src),
    ]
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=settings.ffmpeg_timeout_s,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise ProbeError("probing timed out") from exc
    if result.returncode != 0:
        detail = result.stderr.strip().splitlines()[-1:] or ["unknown ffprobe error"]
        raise ProbeError(detail[0])
    try:
        duration = float(result.stdout.strip())
    except ValueError as exc:
        raise ProbeError("could not determine video duration") from exc
    if not math.isfinite(duration) or duration <= 0:
        raise ProbeError("could not determine video duration")
    return duration
