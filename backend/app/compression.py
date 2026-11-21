"""Compression presets and how they combine with explicit settings."""

from dataclasses import replace
from enum import StrEnum

from app.converter import Dither, GifOptions, OutputFormat


class CompressionPreset(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


PRESETS: dict[CompressionPreset, GifOptions] = {
    # Smooth motion and full palette; the biggest files.
    CompressionPreset.HIGH: GifOptions(
        fps=15, width=480, colors=256, lossy=0, dither=Dither.SIERRA
    ),
    # A good default for sharing: usually a third of "high" or less.
    CompressionPreset.MEDIUM: GifOptions(
        fps=12, width=400, colors=128, lossy=40, dither=Dither.BAYER
    ),
    # Small files for chats and previews; visible banding and choppier motion.
    CompressionPreset.LOW: GifOptions(fps=8, width=320, colors=64, lossy=80, dither=Dither.BAYER),
}


def resolve_options(
    preset: CompressionPreset | None = None,
    *,
    fps: int | None = None,
    width: int | None = None,
    colors: int | None = None,
    lossy: int | None = None,
    format: OutputFormat = OutputFormat.GIF,
) -> GifOptions:
    """Start from a preset (or the plain defaults) and apply explicit overrides."""
    base = replace(PRESETS[preset] if preset is not None else GifOptions(), format=format)
    overrides = {
        name: value
        for name, value in (("fps", fps), ("width", width), ("colors", colors), ("lossy", lossy))
        if value is not None
    }
    return replace(base, **overrides)
