"""Predict GIF file size without rendering the whole clip.

Rendering a whole clip just to learn its size is slow, so the size is
extrapolated from a few short samples spread over the clip. Each sample goes
through the same pipeline as the real conversion (palette, text, gifsicle),
so the estimate reflects the actual content of the video.
"""

import math
from dataclasses import dataclass
from pathlib import Path

from app.converter import (
    GifOptions,
    TrimRange,
    convert_to_gif,
)
from app.overlay import TextOverlay

SAMPLE_COUNT = 3
SAMPLE_SECONDS = 1.0
# Each sample holds at least this many frames, so low frame rates still get a
# meaningful sample.
MIN_SAMPLE_FRAMES = 4
# Clips this short are rendered in full: about as fast as sampling, and exact.
FULL_RENDER_MAX_S = 4.0


@dataclass(frozen=True)
class SizeEstimate:
    options: GifOptions
    bytes: int
    duration: float
    """Length of the GIF in seconds."""
    exact: bool
    """True when the whole clip was rendered rather than sampled."""
    rendered: Path | None = None
    """The rendered GIF when ``exact`` is set, so it can be reused."""


@dataclass(frozen=True)
class Clip:
    """The part of the video that becomes the GIF, with its overlay."""

    src: Path
    start: float
    length: float
    overlay: TextOverlay | None = None

    @classmethod
    def from_trim(
        cls,
        src: Path,
        trim: TrimRange,
        video_duration: float,
        overlay: TextOverlay | None = None,
    ) -> "Clip":
        stop = min(trim.stop or video_duration, video_duration)
        return cls(src=src, start=trim.start, length=max(stop - trim.start, 0.0), overlay=overlay)


def gif_overhead(colors: int) -> int:
    """Bytes in a GIF that do not depend on its length.

    Header and screen descriptor, global colour table (padded to a power of
    two), the looping extension and the trailer.
    """
    table = 2 ** max(1, math.ceil(math.log2(colors)))
    return 13 + 3 * table + 19 + 1


def plan_samples(length: float, fps: int) -> list[tuple[float, float]]:
    """``(offset, duration)`` pairs, in seconds from the start of the clip.

    A single pair covering the whole clip means it is short enough to render.
    """
    sample = max(SAMPLE_SECONDS, MIN_SAMPLE_FRAMES / fps)
    if length <= max(FULL_RENDER_MAX_S, SAMPLE_COUNT * sample * 1.5):
        return [(0.0, length)]
    slot = length / SAMPLE_COUNT
    return [(slot * i + (slot - sample) / 2, sample) for i in range(SAMPLE_COUNT)]


def estimate_size(clip: Clip, options: GifOptions, workdir: Path) -> SizeEstimate:
    """Predict the size of the GIF ``clip`` makes with ``options``."""
    plan = plan_samples(clip.length, options.fps)
    tag = f"{options.fps}-{options.width}-{options.colors}-{options.lossy}-{options.dither}"
    sizes = []
    for i, (offset, duration) in enumerate(plan):
        overlay = clip.overlay.shifted(offset, duration) if clip.overlay else None
        out = convert_to_gif(
            clip.src,
            workdir / f"sample-{tag}-{i}.gif",
            options,
            TrimRange(start=clip.start + offset, duration=duration),
            overlay,
        )
        sizes.append(out.stat().st_size)
        if len(plan) == 1:
            return SizeEstimate(options, sizes[0], clip.length, exact=True, rendered=out)
        out.unlink()
    overhead = gif_overhead(options.colors)
    sampled = sum(duration for _, duration in plan)
    payload = sum(size - overhead for size in sizes)
    predicted = overhead + payload * clip.length / sampled
    return SizeEstimate(options, round(predicted), clip.length, exact=False)
