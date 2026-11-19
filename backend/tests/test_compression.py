import shutil
from dataclasses import replace
from pathlib import Path

import pytest

from app import converter
from app.compression import PRESETS, CompressionPreset, resolve_options
from app.converter import (
    ConversionError,
    Dither,
    GifOptions,
    build_filtergraph,
    build_gifsicle_command,
    convert_to_gif,
)

needs_gifsicle = pytest.mark.skipif(shutil.which("gifsicle") is None, reason="needs gifsicle")


def test_filtergraph_limits_palette_and_dither():
    graph = build_filtergraph(GifOptions(colors=64, dither=Dither.BAYER))
    assert "palettegen=max_colors=64" in graph
    assert "paletteuse=dither=bayer:bayer_scale=3" in graph


def test_gifsicle_command():
    command = build_gifsicle_command(Path("in.gif"), Path("out.gif"), 60)
    assert "--lossy=60" in command and "-O3" in command
    assert command[-3:] == ["-o", "out.gif", "in.gif"]


@pytest.mark.parametrize("kwargs", [{"colors": 1}, {"colors": 257}, {"lossy": -1}, {"lossy": 201}])
def test_options_validation(kwargs):
    with pytest.raises(ValueError):
        GifOptions(**kwargs)


def test_presets_get_smaller():
    high, medium, low = (PRESETS[p] for p in CompressionPreset)
    for bigger, smaller in ((high, medium), (medium, low)):
        assert smaller.fps <= bigger.fps
        assert smaller.width <= bigger.width
        assert smaller.colors <= bigger.colors
        assert smaller.lossy >= bigger.lossy


def test_resolve_without_preset_keeps_defaults():
    assert resolve_options() == GifOptions()


def test_resolve_overrides_preset():
    options = resolve_options(CompressionPreset.LOW, fps=20, colors=200)
    assert options.fps == 20
    assert options.colors == 200
    assert options.width == PRESETS[CompressionPreset.LOW].width
    assert options.lossy == PRESETS[CompressionPreset.LOW].lossy


def test_resolve_rejects_bad_override():
    with pytest.raises(ValueError):
        resolve_options(CompressionPreset.HIGH, colors=1000)


@needs_gifsicle
def test_lossy_conversion_is_smaller(long_video: Path, tmp_path: Path):
    plain = convert_to_gif(long_video, tmp_path / "plain.gif", GifOptions(width=160))
    lossy = convert_to_gif(long_video, tmp_path / "lossy.gif", GifOptions(width=160, lossy=100))
    assert lossy.read_bytes()[:6] == b"GIF89a"
    assert lossy.stat().st_size < plain.stat().st_size
    assert not (tmp_path / "lossy-ffmpeg.gif").exists()


def test_missing_gifsicle_is_reported(sample_video: Path, tmp_path: Path, monkeypatch):
    patched = replace(converter.settings, gifsicle_bin="definitely-not-gifsicle")
    monkeypatch.setattr(converter, "settings", patched)
    with pytest.raises(ConversionError, match="gifsicle is not installed"):
        convert_to_gif(sample_video, tmp_path / "out.gif", GifOptions(width=80, lossy=50))
