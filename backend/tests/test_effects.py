import json
import re
import subprocess
from pathlib import Path

import pytest

from app.converter import GifOptions, OutputFormat, convert_video
from app.effects import MAX_EFFECTS, Effect, EffectType, parse_effects


@pytest.mark.parametrize(
    "effect, expected",
    [
        (Effect(EffectType.GRAYSCALE), "eq=saturation=0"),
        (Effect(EffectType.GRAYSCALE, 25), "eq=saturation=0.75"),
        (Effect(EffectType.SATURATION, 50), "eq=saturation=1.5"),
        (Effect(EffectType.CONTRAST), "eq=contrast=1.8"),
        (Effect(EffectType.BRIGHTNESS, 50), "colorchannelmixer=rr=1.3:gg=1.3:bb=1.3"),
        (Effect(EffectType.BLUR, 50), "gblur=sigma=3"),
    ],
)
def test_effect_filters(effect, expected):
    assert effect.to_filter() == expected


def test_full_sepia_uses_css_matrix():
    graph = Effect(EffectType.SEPIA).to_filter()
    assert graph is not None
    assert graph.startswith("colorchannelmixer=rr=0.393:rg=0.769:rb=0.189:gr=0.349")
    assert graph.endswith("bb=0.131")


def test_half_sepia_blends_with_identity():
    graph = Effect(EffectType.SEPIA, 50).to_filter()
    assert graph is not None
    assert "rr=0.6965" in graph and "rg=0.3845" in graph and "bb=0.5655" in graph


def test_zero_amount_adds_no_filter():
    assert Effect(EffectType.BLUR, 0).to_filter() is None


def test_time_range_becomes_enable_option():
    graph = Effect(EffectType.GRAYSCALE, start=1, end=2.5).to_filter()
    assert graph == "eq=saturation=0:enable='between(t,1,2.5)'"


@pytest.mark.parametrize(
    "kwargs, message",
    [
        ({"amount": 101}, "amount"),
        ({"amount": -1}, "amount"),
        ({"start": -1}, "effect start"),
        ({"start": 2, "end": 1}, "effect end must be greater"),
    ],
)
def test_effect_validation(kwargs, message):
    with pytest.raises(ValueError, match=message):
        Effect(EffectType.BLUR, **kwargs)


def test_effect_shift():
    effect = Effect(EffectType.BLUR, start=3, end=5)
    assert effect.shifted(2, 1) is None
    assert effect.shifted(4, 1) == Effect(EffectType.BLUR, start=None, end=1)
    assert Effect(EffectType.BLUR).shifted(4, 1) == Effect(EffectType.BLUR)


def test_parse_effects():
    effects = parse_effects('[{"type": "sepia", "amount": 40, "start": 1}, {"type": "blur"}]')
    assert effects == [Effect(EffectType.SEPIA, 40, 1), Effect(EffectType.BLUR)]


@pytest.mark.parametrize(
    "raw, message",
    [
        ("{", "JSON array"),
        ('[{"type": "glow"}]', "effects[0.type]"),
        ('[{"type": "blur", "speed": 2}]', "effects[0.speed]"),
        ('[{"type": "blur"}, {"type": "blur", "amount": 200}]', "effect 2: effect amount"),
        (json.dumps([{"type": "blur"}] * (MAX_EFFECTS + 1)), "at most"),
    ],
)
def test_parse_effects_rejects(raw, message):
    with pytest.raises(ValueError, match=re.escape(message)):
        parse_effects(raw)


# --- rendering ------------------------------------------------------------------

W, H = 80, 60


def rgb_frame(video: Path, at: float) -> bytes:
    return subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(video),
            "-ss",
            str(at),
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-",
        ],
        capture_output=True,
        check=True,
    ).stdout


def colourfulness(frame: bytes) -> float:
    """Mean spread between the channels of each pixel; 0 for a gray image."""
    pixels = [frame[i : i + 3] for i in range(0, len(frame), 3)]
    return sum(max(p) - min(p) for p in pixels) / len(pixels)


def render(video: Path, tmp_path: Path, *effects: Effect) -> Path:
    # MP4 keeps colours exact enough to compare without palette noise.
    options = GifOptions(fps=10, width=W, format=OutputFormat.MP4)
    return convert_video(video, tmp_path / "out.mp4", options, effects=effects)


def test_grayscale_only_in_its_time_range(long_video: Path, tmp_path: Path):
    out = render(long_video, tmp_path, Effect(EffectType.GRAYSCALE, start=1, end=2))
    assert colourfulness(rgb_frame(out, 0.5)) > 30
    assert colourfulness(rgb_frame(out, 1.5)) < 5
    assert colourfulness(rgb_frame(out, 3)) > 30


def test_blur_softens_edges(long_video: Path, tmp_path: Path):
    plain = rgb_frame(render(long_video, tmp_path), 1)
    blurred_dir = tmp_path / "blur"
    blurred_dir.mkdir()
    blurred = rgb_frame(render(long_video, blurred_dir, Effect(EffectType.BLUR)), 1)

    def edges(frame: bytes) -> int:
        return sum(abs(frame[i] - frame[i + 3]) for i in range(0, len(frame) - 3, 3))

    assert edges(blurred) < edges(plain) * 0.8
