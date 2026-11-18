import dataclasses
import shutil
import subprocess
from pathlib import Path

import pytest

from app import converter
from app.config import settings
from app.converter import GifOptions, build_filtergraph, convert_to_gif
from app.overlay import TextOverlay, TextPosition, escape_filter_value, is_valid_color

FRAME_W, FRAME_H = 160, 120


def gray_frame(gif: Path, at: float) -> bytes:
    """Decode one frame of a GIF as 8-bit grayscale pixels."""
    return subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            f"{at}",
            "-i",
            str(gif),
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "gray",
            "-",
        ],
        capture_output=True,
        check=True,
    ).stdout


def rows(frame: bytes, top: int, bottom: int) -> bytes:
    return frame[top * FRAME_W : bottom * FRAME_W]


def changed_pixels(a: bytes, b: bytes, threshold: int = 40) -> int:
    return sum(abs(x - y) > threshold for x, y in zip(a, b, strict=True))


# --- validation -------------------------------------------------------------


@pytest.mark.parametrize(
    "kwargs",
    [
        {"text": ""},
        {"text": "   \n "},
        {"text": "x" * 501},
        {"text": "bell\x07"},
        {"text": "a", "font_size": 4},
        {"text": "a", "font_size": 500},
        {"text": "a", "outline": 11},
        {"text": "a", "color": "red;drawbox"},
        {"text": "a", "color": "#12345"},
        {"text": "a", "box_color": "black@2"},
        {"text": "a", "outline_color": "white:x=0"},
        {"text": "a", "x": 10},
        {"text": "a", "y": 10},
        {"text": "a", "x": -1, "y": 0},
        {"text": "a", "start": -1},
        {"text": "a", "end": float("nan")},
        {"text": "a", "start": 2, "end": 2},
        {"text": "a", "start": 2, "end": 1},
    ],
)
def test_overlay_validation(kwargs):
    with pytest.raises(ValueError):
        TextOverlay(**kwargs)


@pytest.mark.parametrize(
    "value, ok",
    [
        ("white", True),
        ("#FFCC00", True),
        ("#ffcc0080", True),
        ("black@0.5", True),
        ("#000000@1", True),
        ("black@1.5", False),
        ("#fff", False),
        ("red,drawbox", False),
        ("", False),
    ],
)
def test_color_format(value, ok):
    assert is_valid_color(value) is ok


def test_text_may_contain_line_breaks_and_tabs():
    TextOverlay(text="line one\r\nline two\tend")


# --- filter building ----------------------------------------------------------


def test_position_presets():
    assert TextOverlay("a", position=TextPosition.TOP).coordinates == ("(w-text_w)/2", "10")
    assert TextOverlay("a", position=TextPosition.CENTER).coordinates == (
        "(w-text_w)/2",
        "(h-text_h)/2",
    )
    assert TextOverlay("a", position=TextPosition.BOTTOM_RIGHT).coordinates == (
        "w-text_w-10",
        "h-text_h-10",
    )


def test_explicit_offset_overrides_preset():
    overlay = TextOverlay("a", position=TextPosition.CENTER, x=5, y=7)
    assert overlay.coordinates == ("5", "7")


@pytest.mark.parametrize(
    "start, end, expected",
    [
        (None, None, None),
        (1, None, "gte(t,1)"),
        (None, 2.5, "lt(t,2.5)"),
        (0.5, 2, "between(t,0.5,2)"),
    ],
)
def test_enable_expression(start, end, expected):
    assert TextOverlay("a", start=start, end=end).enable_expression == expected


def test_filter_keeps_user_text_out_of_the_graph(tmp_path: Path):
    overlay = TextOverlay("evil'];[x]drawbox:%{pts}", box=True, start=1, end=2)
    graph = overlay.to_filter(tmp_path / "t.txt", Path("/fonts/f.ttf"))
    assert "evil" not in graph
    assert "expansion=none" in graph
    assert "box=1" in graph
    assert "enable='between(t,1,2)'" in graph


def test_filter_without_outline_or_box(tmp_path: Path):
    graph = TextOverlay("a", outline=0).to_filter(tmp_path / "t.txt", Path("/f.ttf"))
    assert "borderw" not in graph
    assert "box=1" not in graph


def test_escape_filter_value():
    assert escape_filter_value("/plain/path.ttf") == "/plain/path.ttf"
    assert escape_filter_value("C:\\f.ttf") == "C\\\\:\\\\\\\\f.ttf"
    assert escape_filter_value("a'b") == "a\\\\\\'b"
    assert escape_filter_value("a,b;c[d]") == "a\\,b\\;c\\[d\\]"


def test_text_goes_between_scale_and_palette():
    graph = build_filtergraph(GifOptions(width=320), "drawtext=x=1")
    assert graph.index("scale=") < graph.index("drawtext") < graph.index("split")


def test_text_file_uses_lf(tmp_path: Path):
    path = TextOverlay("один\r\nдва\rтри").write_text_file(tmp_path / "t.txt")
    assert path.read_text(encoding="utf-8") == "один\nдва\nтри"


# --- rendering ------------------------------------------------------------------


@pytest.fixture(scope="module")
def plain_gif(long_video: Path, tmp_path_factory: pytest.TempPathFactory) -> Path:
    out = tmp_path_factory.mktemp("plain") / "plain.gif"
    return convert_to_gif(long_video, out, GifOptions(fps=10, width=FRAME_W))


def test_bundled_font_exists():
    assert settings.font_file.is_file()


def test_cyrillic_text_is_drawn(long_video: Path, plain_gif: Path, tmp_path: Path):
    overlay = TextOverlay("Привіт, ҐЄЇ!", font_size=24, position=TextPosition.BOTTOM, box=True)
    out = convert_to_gif(long_video, tmp_path / "t.gif", GifOptions(width=FRAME_W), overlay=overlay)
    with_text, without = gray_frame(out, 1), gray_frame(plain_gif, 1)
    bottom = (FRAME_H - 40, FRAME_H)
    assert changed_pixels(rows(with_text, *bottom), rows(without, *bottom)) > 200
    # The top of the frame is left alone.
    assert changed_pixels(rows(with_text, 0, 40), rows(without, 0, 40)) < 20


def test_text_shown_only_in_time_range(long_video: Path, plain_gif: Path, tmp_path: Path):
    overlay = TextOverlay("TEXT", font_size=40, position=TextPosition.CENTER, start=1, end=2)
    out = convert_to_gif(long_video, tmp_path / "t.gif", GifOptions(width=FRAME_W), overlay=overlay)
    for at, visible in ((0.5, False), (1.5, True), (3, False)):
        diff = changed_pixels(gray_frame(out, at), gray_frame(plain_gif, at))
        assert (diff > 200) is visible, f"t={at}: {diff} changed pixels"


def test_font_path_with_special_characters(
    long_video: Path, plain_gif: Path, tmp_path: Path, monkeypatch
):
    font_dir = tmp_path / "my fonts:v1'[x],;"
    font_dir.mkdir()
    font = Path(shutil.copy(settings.font_file, font_dir / "font.ttf"))
    monkeypatch.setattr(converter, "settings", dataclasses.replace(settings, font_file=font))
    overlay = TextOverlay("50% 'off' %{pts}", font_size=20, position=TextPosition.TOP)
    out = convert_to_gif(long_video, tmp_path / "t.gif", GifOptions(width=FRAME_W), overlay=overlay)
    assert changed_pixels(gray_frame(out, 1), gray_frame(plain_gif, 1)) > 100
