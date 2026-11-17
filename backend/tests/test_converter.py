from pathlib import Path

import pytest

from app.converter import ConversionError, GifOptions, build_filtergraph, convert_to_gif


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
    out = convert_to_gif(sample_video, tmp_path / "out.gif", GifOptions(fps=5, width=80))
    assert gif_size(out) == (80, 60)


def test_convert_rejects_non_video(tmp_path: Path, sample_video: Path):
    bogus = tmp_path / "bogus.mp4"
    bogus.write_bytes(b"definitely not a video")
    with pytest.raises(ConversionError):
        convert_to_gif(bogus, tmp_path / "out.gif")
