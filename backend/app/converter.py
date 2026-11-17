"""Video → GIF conversion using FFmpeg's two-stage palette pipeline."""

import subprocess
from dataclasses import dataclass
from pathlib import Path

from app.config import settings

MIN_FPS, MAX_FPS = 1, 30
MIN_WIDTH, MAX_WIDTH = 16, 1920


class ConversionError(RuntimeError):
    """FFmpeg could not convert the input (bad file, unsupported codec, timeout)."""


@dataclass(frozen=True)
class GifOptions:
    fps: int = 10
    width: int = 480

    def __post_init__(self) -> None:
        if not MIN_FPS <= self.fps <= MAX_FPS:
            raise ValueError(f"fps must be between {MIN_FPS} and {MAX_FPS}")
        if not MIN_WIDTH <= self.width <= MAX_WIDTH:
            raise ValueError(f"width must be between {MIN_WIDTH} and {MAX_WIDTH}")


def build_filtergraph(options: GifOptions) -> str:
    """Single-pass palettegen/paletteuse graph.

    The video is split in two: one branch builds an optimal 256-colour palette
    for the whole clip, the other is mapped onto it. This gives far better
    colours than FFmpeg's default GIF palette.
    """
    return (
        f"fps={options.fps},"
        f"scale={options.width}:-1:flags=lanczos,"
        "split[a][b];"
        "[a]palettegen=stats_mode=diff[p];"
        "[b][p]paletteuse=dither=sierra2_4a"
    )


def build_command(src: Path, dst: Path, options: GifOptions) -> list[str]:
    return [
        settings.ffmpeg_bin,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(src),
        "-filter_complex",
        build_filtergraph(options),
        "-loop",
        "0",
        str(dst),
    ]


def convert_to_gif(src: Path, dst: Path, options: GifOptions | None = None) -> Path:
    options = options or GifOptions()
    try:
        result = subprocess.run(
            build_command(src, dst, options),
            capture_output=True,
            text=True,
            timeout=settings.ffmpeg_timeout_s,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise ConversionError("conversion timed out") from exc
    if result.returncode != 0 or not dst.exists() or dst.stat().st_size == 0:
        detail = result.stderr.strip().splitlines()[-1:] or ["unknown ffmpeg error"]
        raise ConversionError(detail[0])
    return dst
