from pathlib import Path

import pytest

from app.converter import (
    ConversionError,
    GifOptions,
    OutputFormat,
    build_filtergraph,
    convert_video,
    encoder_args,
)


def gif_size(path: Path) -> tuple[int, int]:
    header = path.read_bytes()[:10]
    assert header[:6] in (b"GIF87a", b"GIF89a")
    return int.from_bytes(header[6:8], "little"), int.from_bytes(header[8:10], "little")


def test_filtergraph_uses_palette():
    graph = build_filtergraph(GifOptions(fps=12, width=320))
    assert "fps=12" in graph
    assert "scale=320:-1" in graph
    assert "palettegen" in graph and "paletteuse" in graph


@pytest.mark.parametrize("kwargs", [{"fps": 0}, {"fps": 31}, {"width": 8}, {"width": 4000}])
def test_options_validation(kwargs):
    with pytest.raises(ValueError):
        GifOptions(**kwargs)


def test_convert_produces_gif(sample_video: Path, tmp_path: Path):
    out = convert_video(sample_video, tmp_path / "out.gif", GifOptions(fps=5, width=80))
    assert gif_size(out) == (80, 60)


def test_convert_rejects_non_video(tmp_path: Path, sample_video: Path):
    bogus = tmp_path / "bogus.mp4"
    bogus.write_bytes(b"definitely not a video")
    with pytest.raises(ConversionError):
        convert_video(bogus, tmp_path / "out.gif")


def test_webp_filtergraph_skips_palette():
    graph = build_filtergraph(GifOptions(fps=12, width=320, format=OutputFormat.WEBP))
    assert graph == "fps=12,scale=320:-1:flags=lanczos"


def test_mp4_filtergraph_uses_even_size():
    graph = build_filtergraph(GifOptions(fps=12, width=321, format=OutputFormat.MP4))
    assert "scale=320:-2" in graph
    assert graph.endswith("format=yuv420p")
    assert "palettegen" not in graph


def test_text_filter_runs_before_encoding():
    graph = build_filtergraph(GifOptions(format=OutputFormat.MP4), "drawtext=text=x")
    assert graph.index("scale=") < graph.index("drawtext") < graph.index("format=yuv420p")


@pytest.mark.parametrize(
    "output_format, expected",
    [
        (OutputFormat.GIF, ["-f", "gif"]),
        (OutputFormat.WEBP, ["libwebp_anim", "-f", "webp"]),
        (OutputFormat.MP4, ["libx264", "-f", "mp4"]),
    ],
)
def test_encoder_args(output_format, expected):
    args = encoder_args(GifOptions(format=output_format))
    assert all(arg in args for arg in expected)


def test_compression_level_lowers_quality():
    assert GifOptions(lossy=0).webp_quality > GifOptions(lossy=80).webp_quality >= 5
    assert GifOptions(lossy=0).mp4_crf < GifOptions(lossy=80).mp4_crf <= 45


def test_convert_produces_webp(sample_video: Path, tmp_path: Path):
    options = GifOptions(fps=5, width=80, lossy=40, format=OutputFormat.WEBP)
    out = convert_video(sample_video, tmp_path / "out.webp", options)
    data = out.read_bytes()
    assert data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    assert not (tmp_path / "out-ffmpeg.gif").exists()


def test_convert_produces_mp4(sample_video: Path, tmp_path: Path):
    options = GifOptions(fps=5, width=81, format=OutputFormat.MP4)
    out = convert_video(sample_video, tmp_path / "out.mp4", options)
    assert out.read_bytes()[4:8] == b"ftyp"
