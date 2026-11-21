"""Video → GIF, WebP or MP4 conversion with FFmpeg.

GIFs go through FFmpeg's two-stage palette pipeline (and gifsicle for lossy
compression); WebP and MP4 use libwebp and libx264.
"""

import math
import subprocess
from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

from app.config import settings
from app.overlay import TextOverlay

MIN_FPS, MAX_FPS = 1, 30
MIN_WIDTH, MAX_WIDTH = 16, 1920
MIN_COLORS, MAX_COLORS = 2, 256
MIN_LOSSY, MAX_LOSSY = 0, 200
# Container durations are often rounded, so allow asking for a hair past the end.
DURATION_TOLERANCE_S = 0.05


class ConversionError(RuntimeError):
    """FFmpeg could not convert the input (bad file, unsupported codec, timeout)."""


class OutputFormat(StrEnum):
    GIF = "gif"
    WEBP = "webp"
    MP4 = "mp4"

    @property
    def media_type(self) -> str:
        return {"gif": "image/gif", "webp": "image/webp", "mp4": "video/mp4"}[self.value]

    @property
    def extension(self) -> str:
        return self.value


class Dither(StrEnum):
    """paletteuse dithering modes.

    Error diffusion (sierra2_4a) looks best but its noise compresses poorly;
    ordered Bayer dithering gives smaller files at a small cost in quality.
    """

    NONE = "none"
    BAYER = "bayer"
    SIERRA = "sierra2_4a"

    @property
    def filter_value(self) -> str:
        if self is Dither.BAYER:
            return "bayer:bayer_scale=3"
        return self.value


@dataclass(frozen=True)
class GifOptions:
    """Encoding settings.

    ``lossy`` is the compression level for every format: for GIF it is
    gifsicle's ``--lossy`` level (0 turns the gifsicle pass off), for WebP and
    MP4 it maps to the encoder's quality (see ``webp_quality`` and ``mp4_crf``).
    ``colors`` and ``dither`` only apply to GIF.
    """

    fps: int = 10
    width: int = 480
    colors: int = MAX_COLORS
    lossy: int = 0
    dither: Dither = Dither.SIERRA
    format: OutputFormat = OutputFormat.GIF

    def __post_init__(self) -> None:
        if not MIN_FPS <= self.fps <= MAX_FPS:
            raise ValueError(f"fps must be between {MIN_FPS} and {MAX_FPS}")
        if not MIN_WIDTH <= self.width <= MAX_WIDTH:
            raise ValueError(f"width must be between {MIN_WIDTH} and {MAX_WIDTH}")
        if not MIN_COLORS <= self.colors <= MAX_COLORS:
            raise ValueError(f"colors must be between {MIN_COLORS} and {MAX_COLORS}")
        if not MIN_LOSSY <= self.lossy <= MAX_LOSSY:
            raise ValueError(f"lossy must be between {MIN_LOSSY} and {MAX_LOSSY}")

    @property
    def webp_quality(self) -> int:
        """libwebp quality (0-100): 90 without compression, lower as ``lossy`` grows."""
        return max(5, round(90 - self.lossy * 0.35))

    @property
    def mp4_crf(self) -> int:
        """libx264 constant rate factor: 20 without compression, higher as ``lossy`` grows."""
        return min(45, round(20 + self.lossy * 0.1))


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
    """Filtergraph that turns the input into frames for ``options.format``.

    ``text_filter`` is one or more drawtext filters joined with commas.

    For GIF, the video is split in two: one branch builds an optimal palette
    of up to ``options.colors`` colours for the whole clip, the other is
    mapped onto it. This gives far better colours than FFmpeg's default GIF
    palette.

    ``text_filter`` (a drawtext filter) runs after scaling, so font sizes and
    offsets are in output pixels, and before palettegen, so the palette has
    the text colours.
    """
    text = f",{text_filter}" if text_filter else ""
    if options.format is OutputFormat.MP4:
        # H.264 in yuv420p needs even dimensions.
        width = options.width - options.width % 2
        return f"fps={options.fps},scale={width}:-2:flags=lanczos{text},format=yuv420p"
    frames = f"fps={options.fps},scale={options.width}:-1:flags=lanczos{text}"
    if options.format is OutputFormat.WEBP:
        return frames
    return (
        f"{frames},"
        "split[a][b];"
        f"[a]palettegen=max_colors={options.colors}:stats_mode=diff[p];"
        f"[b][p]paletteuse=dither={options.dither.filter_value}"
    )


def encoder_args(options: GifOptions) -> list[str]:
    """Output options that select and tune the encoder for ``options.format``."""
    if options.format is OutputFormat.WEBP:
        return [
            "-c:v",
            "libwebp_anim",
            "-lossless",
            "0",
            "-quality",
            str(options.webp_quality),
            "-loop",
            "0",
            "-an",
            "-f",
            "webp",
        ]
    if options.format is OutputFormat.MP4:
        return [
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            str(options.mp4_crf),
            "-movflags",
            "+faststart",
            "-an",
            "-f",
            "mp4",
        ]
    return ["-loop", "0", "-f", "gif"]


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
        *encoder_args(options),
        str(dst),
    ]


def build_gifsicle_command(src: Path, dst: Path, lossy: int) -> list[str]:
    return [
        settings.gifsicle_bin,
        "--no-warnings",
        "-O3",
        f"--lossy={lossy}",
        "-o",
        str(dst),
        str(src),
    ]


def convert_video(
    src: Path,
    dst: Path,
    options: GifOptions | None = None,
    trim: TrimRange | None = None,
    overlays: Sequence[TextOverlay] = (),
) -> Path:
    """Render ``src`` to ``dst``; ``overlays`` are drawn in order, the last on top."""
    options = options or GifOptions()
    text_filters = [
        overlay.to_filter(
            overlay.write_text_file(dst.with_name(f"{dst.stem}-text-{i}.txt")), settings.font_file
        )
        for i, overlay in enumerate(overlays)
    ]
    text_filter = ",".join(text_filters) or None
    # With lossy GIF compression, FFmpeg writes an intermediate GIF for gifsicle.
    use_gifsicle = options.format is OutputFormat.GIF and options.lossy > 0
    ffmpeg_dst = dst.with_name(f"{dst.stem}-ffmpeg.gif") if use_gifsicle else dst
    _run(build_command(src, ffmpeg_dst, options, trim, text_filter), ffmpeg_dst, "ffmpeg")
    if use_gifsicle:
        try:
            _run(build_gifsicle_command(ffmpeg_dst, dst, options.lossy), dst, "gifsicle")
        finally:
            ffmpeg_dst.unlink(missing_ok=True)
    return dst


def _run(command: list[str], dst: Path, tool: str) -> None:
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=settings.ffmpeg_timeout_s,
            check=False,
        )
    except FileNotFoundError as exc:
        raise ConversionError(f"{tool} is not installed") from exc
    except subprocess.TimeoutExpired as exc:
        raise ConversionError("conversion timed out") from exc
    if result.returncode != 0 or not dst.exists() or dst.stat().st_size == 0:
        detail = result.stderr.strip().splitlines()[-1:] or [f"unknown {tool} error"]
        raise ConversionError(detail[0])
