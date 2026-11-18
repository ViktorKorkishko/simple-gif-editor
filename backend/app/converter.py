"""Video → GIF conversion using FFmpeg's two-stage palette pipeline."""

import math
import subprocess
from dataclasses import dataclass
from pathlib import Path

from app.config import settings
from app.overlay import TextOverlay

MIN_FPS, MAX_FPS = 1, 30
MIN_WIDTH, MAX_WIDTH = 16, 1920
# Container durations are often rounded, so allow asking for a hair past the end.
DURATION_TOLERANCE_S = 0.05


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


@dataclass(frozen=True)
class TrimRange:
    """Part of the video to keep, in seconds.

    ``end`` and ``duration`` are alternative ways to give the length; set at
    most one of them. With neither, the clip runs to the end of the video.
    """

    start: float = 0.0
    end: float | None = None
    duration: float | None = None

    def __post_init__(self) -> None:
        values = (self.start, self.end, self.duration)
        if any(v is not None and not math.isfinite(v) for v in values):
            raise ValueError("start, end and duration must be finite numbers")
        if self.start < 0:
            raise ValueError("start must not be negative")
        if self.end is not None and self.duration is not None:
            raise ValueError("pass either end or duration, not both")
        if self.end is not None and self.end <= self.start:
            raise ValueError("end must be greater than start")
        if self.duration is not None and self.duration <= 0:
            raise ValueError("duration must be greater than 0")

    @property
    def stop(self) -> float | None:
        """Absolute end time, if one was given."""
        if self.end is not None:
            return self.end
        if self.duration is not None:
            return self.start + self.duration
        return None

    @property
    def length(self) -> float | None:
        stop = self.stop
        return None if stop is None else stop - self.start

    @property
    def is_full(self) -> bool:
        return self.start == 0 and self.stop is None

    def check_within(self, video_duration: float) -> None:
        """Raise ``ValueError`` if the range does not fit in the video."""
        if self.start >= video_duration:
            raise ValueError(
                f"start ({self.start:g}s) must be less than the video duration "
                f"({video_duration:.2f}s)"
            )
        stop = self.stop
        if stop is not None and stop > video_duration + DURATION_TOLERANCE_S:
            raise ValueError(
                f"end ({stop:g}s) is past the end of the video ({video_duration:.2f}s)"
            )


def build_filtergraph(options: GifOptions, text_filter: str | None = None) -> str:
    """Single-pass palettegen/paletteuse graph.

    The video is split in two: one branch builds an optimal 256-colour palette
    for the whole clip, the other is mapped onto it. This gives far better
    colours than FFmpeg's default GIF palette.

    ``text_filter`` (a drawtext filter) runs after scaling, so font sizes and
    offsets are in output pixels, and before palettegen, so the palette has
    the text colours.
    """
    text = f"{text_filter}," if text_filter else ""
    return (
        f"fps={options.fps},"
        f"scale={options.width}:-1:flags=lanczos,"
        f"{text}"
        "split[a][b];"
        "[a]palettegen=stats_mode=diff[p];"
        "[b][p]paletteuse=dither=sierra2_4a"
    )


def build_command(
    src: Path,
    dst: Path,
    options: GifOptions,
    trim: TrimRange | None = None,
    text_filter: str | None = None,
) -> list[str]:
    command = [settings.ffmpeg_bin, "-hide_banner", "-loglevel", "error", "-y"]
    # -ss before -i seeks in the input; since the video is re-encoded, the cut is
    # still frame-accurate. -t after -i limits the output length.
    if trim is not None and trim.start > 0:
        command += ["-ss", f"{trim.start:.3f}"]
    command += ["-i", str(src)]
    if trim is not None and trim.length is not None:
        command += ["-t", f"{trim.length:.3f}"]
    return [
        *command,
        "-filter_complex",
        build_filtergraph(options, text_filter),
        "-loop",
        "0",
        str(dst),
    ]


def convert_to_gif(
    src: Path,
    dst: Path,
    options: GifOptions | None = None,
    trim: TrimRange | None = None,
    overlay: TextOverlay | None = None,
) -> Path:
    options = options or GifOptions()
    text_filter = None
    if overlay is not None:
        text_file = overlay.write_text_file(dst.with_name(f"{dst.stem}-text.txt"))
        text_filter = overlay.to_filter(text_file, settings.font_file)
    try:
        result = subprocess.run(
            build_command(src, dst, options, trim, text_filter),
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
