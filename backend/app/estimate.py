"""Predict output file size and pick settings that fit a size budget.

Rendering a whole clip just to learn its size is slow, so the size is
extrapolated from a few short samples spread over the clip. Each sample goes
through the same pipeline as the real conversion (palette, text, gifsicle),
so the estimate reflects the actual content of the video.
"""

import math
from dataclasses import dataclass, replace
from pathlib import Path

from app.converter import (
    MIN_FPS,
    MIN_WIDTH,
    Dither,
    GifOptions,
    OutputFormat,
    TrimRange,
    convert_video,
)
from app.overlay import TextOverlay

SAMPLE_COUNT = 3
SAMPLE_SECONDS = 1.0
# Each sample holds at least this many frames, so low frame rates still get a
# meaningful sample.
MIN_SAMPLE_FRAMES = 4
# Clips this short are rendered in full: about as fast as sampling, and exact.
FULL_RENDER_MAX_S = 4.0
# Aim this far below the target, since estimates are approximate.
TARGET_MARGIN = 0.92
# Full renders allowed when the first result misses the target.
MAX_RENDER_ATTEMPTS = 3


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


class TargetUnreachableError(ValueError):
    """Even the smallest settings produce a GIF bigger than the target."""

    def __init__(self, target_bytes: int, smallest: SizeEstimate) -> None:
        self.target_bytes = target_bytes
        self.smallest = smallest
        super().__init__(
            f"cannot fit the file into {target_bytes / 1024:.0f} KB; the smallest "
            f"settings give about {smallest.bytes / 1024:.0f} KB. Try a shorter clip"
        )


@dataclass(frozen=True)
class Clip:
    """The part of the video that becomes the output, with its text overlays."""

    src: Path
    start: float
    length: float
    overlays: tuple[TextOverlay, ...] = ()

    @classmethod
    def from_trim(
        cls,
        src: Path,
        trim: TrimRange,
        video_duration: float,
        overlays: tuple[TextOverlay, ...] = (),
    ) -> "Clip":
        stop = min(trim.stop or video_duration, video_duration)
        length = max(stop - trim.start, 0.0)
        return cls(src=src, start=trim.start, length=length, overlays=overlays)


def gif_overhead(colors: int) -> int:
    """Bytes in a GIF that do not depend on its length.

    Header and screen descriptor, global colour table (padded to a power of
    two), the looping extension and the trailer.
    """
    table = 2 ** max(1, math.ceil(math.log2(colors)))
    return 13 + 3 * table + 19 + 1


# Rough size of the WebP and MP4 headers; small next to the frames either way.
_CONTAINER_OVERHEAD = {OutputFormat.WEBP: 40, OutputFormat.MP4: 1000}


def container_overhead(options: GifOptions) -> int:
    """Bytes of the output file that do not depend on its length."""
    if options.format is OutputFormat.GIF:
        return gif_overhead(options.colors)
    return _CONTAINER_OVERHEAD[options.format]


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
    tag = (
        f"{options.fps}-{options.width}-{options.colors}-{options.lossy}-{options.dither}"
        f".{options.format.extension}"
    )
    sizes = []
    for i, (offset, duration) in enumerate(plan):
        shifted = (overlay.shifted(offset, duration) for overlay in clip.overlays)
        overlays = [overlay for overlay in shifted if overlay is not None]
        out = convert_video(
            clip.src,
            workdir / f"sample-{i}-{tag}",
            options,
            TrimRange(start=clip.start + offset, duration=duration),
            overlays,
        )
        sizes.append(out.stat().st_size)
        if len(plan) == 1:
            return SizeEstimate(options, sizes[0], clip.length, exact=True, rendered=out)
        out.unlink()
    overhead = container_overhead(options)
    sampled = sum(duration for _, duration in plan)
    payload = sum(size - overhead for size in sizes)
    predicted = overhead + payload * clip.length / sampled
    return SizeEstimate(options, round(predicted), clip.length, exact=False)


def size_ladder(base: GifOptions) -> list[GifOptions]:
    """Settings from ``base`` down to the smallest, each step a bit smaller.

    Every step lowers at least one setting and raises none, so file sizes
    shrink along the ladder. Palette, lossiness and frame rate go first;
    after that only the width keeps shrinking.
    """

    def tier(colors: int, lossy: int, fps_factor: float) -> dict:
        return {
            "colors": min(base.colors, colors),
            "lossy": max(base.lossy, lossy),
            "dither": base.dither if base.dither is Dither.NONE else Dither.BAYER,
            "fps": max(MIN_FPS, min(base.fps, round(base.fps * fps_factor))),
        }

    def width(factor: float) -> dict:
        return {"width": max(MIN_WIDTH, round(base.width * factor / 2) * 2)}

    steps = [
        tier(128, 40, 0.8),
        width(0.85),
        tier(64, 80, 0.65),
        width(0.7),
        width(0.6),
        tier(32, 120, 0.5),
        width(0.5),
        width(0.4),
        width(0.3),
        width(0.2),
    ]
    ladder = [base]
    for step in steps:
        options = replace(ladder[-1], **step)
        if options != ladder[-1]:
            ladder.append(options)
    return ladder


class LadderSearch:
    """Estimates along a ``size_ladder``, each computed at most once."""

    def __init__(self, clip: Clip, base: GifOptions, workdir: Path) -> None:
        self.clip = clip
        self.ladder = size_ladder(base)
        self.workdir = workdir
        self._cache: dict[int, SizeEstimate] = {}

    def estimate(self, index: int) -> SizeEstimate:
        if index not in self._cache:
            self._cache[index] = estimate_size(self.clip, self.ladder[index], self.workdir)
        return self._cache[index]

    def first_fit(self, target_bytes: int, start: int = 0, scale: float = 1.0) -> int | None:
        """Index of the best step from ``start`` that fits, or ``None``.

        ``scale`` corrects sampled estimates when a render showed them to be
        off. Sizes shrink along the ladder, so this is a binary search.
        """
        last = len(self.ladder) - 1
        if start > last or not self._fits(last, target_bytes, scale):
            return None
        lo, hi = start, last
        while lo < hi:
            mid = (lo + hi) // 2
            if self._fits(mid, target_bytes, scale):
                hi = mid
            else:
                lo = mid + 1
        return lo

    def _fits(self, index: int, target_bytes: int, scale: float) -> bool:
        estimate = self.estimate(index)
        if estimate.exact:
            return estimate.bytes <= target_bytes
        return estimate.bytes * scale <= target_bytes * TARGET_MARGIN


def fit_to_target(clip: Clip, base: GifOptions, target_bytes: int, workdir: Path) -> SizeEstimate:
    """Estimate for the best settings on the ladder that fit the target.

    Raises ``TargetUnreachableError`` if even the smallest settings do not.
    """
    search = LadderSearch(clip, base, workdir)
    index = search.first_fit(target_bytes)
    if index is None:
        raise TargetUnreachableError(target_bytes, search.estimate(len(search.ladder) - 1))
    return search.estimate(index)


def convert_to_target(
    clip: Clip, base: GifOptions, target_bytes: int, workdir: Path, dst: Path
) -> GifOptions:
    """Render the GIF at the best settings that fit ``target_bytes``.

    If a render still comes out too big, step further down the ladder, scaling
    the remaining estimates by how far off the last one was.
    """
    search = LadderSearch(clip, base, workdir)
    smallest = len(search.ladder) - 1
    index = search.first_fit(target_bytes)
    scale = 1.0
    for _ in range(MAX_RENDER_ATTEMPTS):
        if index is None:
            break
        estimate = search.estimate(index)
        if estimate.rendered is not None:
            # Short clips are rendered in full while estimating.
            estimate.rendered.replace(dst)
            return estimate.options
        convert_video(clip.src, dst, estimate.options, _trim(clip), clip.overlays)
        actual = dst.stat().st_size
        if actual <= target_bytes:
            return estimate.options
        scale = max(scale, actual / estimate.bytes)
        index = search.first_fit(target_bytes, start=index + 1, scale=scale)
    raise TargetUnreachableError(target_bytes, search.estimate(smallest))


def _trim(clip: Clip) -> TrimRange:
    return TrimRange(start=clip.start, duration=clip.length)
