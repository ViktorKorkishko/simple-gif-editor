import shutil
from pathlib import Path

import pytest

from app.converter import MIN_WIDTH, GifOptions, OutputFormat, TrimRange, convert_video
from app.estimate import (
    SAMPLE_COUNT,
    Clip,
    TargetUnreachableError,
    container_overhead,
    convert_to_target,
    estimate_size,
    fit_to_target,
    gif_overhead,
    plan_samples,
    size_ladder,
)
from app.overlay import TextOverlay

needs_gifsicle = pytest.mark.skipif(shutil.which("gifsicle") is None, reason="needs gifsicle")


def test_short_clip_is_rendered_whole():
    assert plan_samples(3.0, fps=10) == [(0.0, 3.0)]


def test_long_clip_is_sampled_evenly():
    plan = plan_samples(30.0, fps=10)
    assert len(plan) == SAMPLE_COUNT
    offsets = [offset for offset, _ in plan]
    assert offsets == sorted(offsets)
    assert all(offset >= 0 and offset + length <= 30.0 for offset, length in plan)
    assert plan[0][0] < 10 < plan[1][0] < 20 < plan[2][0]


def test_low_fps_samples_hold_several_frames():
    (_, length), *_ = plan_samples(60.0, fps=2)
    assert length * 2 >= 4


@pytest.mark.parametrize("colors, table", [(256, 256), (200, 256), (64, 64), (2, 2)])
def test_gif_overhead(colors, table):
    assert gif_overhead(colors) == 13 + 3 * table + 20


def test_ladder_only_goes_down():
    ladder = size_ladder(GifOptions(fps=15, width=480))
    assert ladder[0] == GifOptions(fps=15, width=480)
    assert len(ladder) > 5
    for bigger, smaller in zip(ladder, ladder[1:], strict=False):
        assert smaller != bigger
        assert smaller.fps <= bigger.fps
        assert smaller.width <= bigger.width
        assert smaller.colors <= bigger.colors
        assert smaller.lossy >= bigger.lossy
    assert ladder[-1].width < 480 / 4


def test_ladder_respects_tiny_base():
    ladder = size_ladder(GifOptions(fps=1, width=MIN_WIDTH, colors=2, lossy=200))
    assert all(o.fps == 1 and o.width == MIN_WIDTH for o in ladder)


def test_overlay_shift_without_timing_is_unchanged():
    overlay = TextOverlay(text="hi")
    assert overlay.shifted(5, 1) is overlay


@pytest.mark.parametrize(
    "start, end, offset, expected",
    [
        (2, 4, 1, (1, 3)),  # starts inside the sample
        (2, 4, 3, (None, 1)),  # already showing when the sample starts
        (2, None, 5, (None, None)),  # shown to the end
        (2, 4, 5, None),  # gone before the sample
        (8, 9, 1, None),  # appears after the sample
    ],
)
def test_overlay_shift(start, end, offset, expected):
    shifted = TextOverlay(text="hi", start=start, end=end).shifted(offset, 2)
    if expected is None:
        assert shifted is None
    else:
        assert (shifted.start, shifted.end) == expected


def test_short_clip_estimate_is_exact(long_video: Path, tmp_path: Path):
    options = GifOptions(width=80)
    result = estimate_size(Clip(long_video, 0, 4.0), options, tmp_path)
    actual = convert_video(long_video, tmp_path / "full.gif", options).stat().st_size
    assert result.exact
    assert result.bytes == actual
    assert result.rendered is not None and result.rendered.exists()


def test_sampled_estimate_is_close(sampled_video: Path, tmp_path: Path):
    options = GifOptions(width=120)
    result = estimate_size(Clip(sampled_video, 0, 8.0), options, tmp_path)
    actual = convert_video(sampled_video, tmp_path / "full.gif", options).stat().st_size
    assert not result.exact
    assert result.bytes == pytest.approx(actual, rel=0.25)
    assert not list(tmp_path.glob("sample-*"))


def test_estimate_respects_trim(sampled_video: Path, tmp_path: Path):
    clip = Clip.from_trim(sampled_video, TrimRange(start=6), 8.0)
    assert (clip.start, clip.length) == (6, 2)
    result = estimate_size(clip, GifOptions(width=80), tmp_path)
    assert result.exact and result.duration == 2


def test_estimate_with_timed_text(sampled_video: Path, tmp_path: Path):
    overlay = TextOverlay(text="hello", start=1, end=2)
    result = estimate_size(Clip(sampled_video, 0, 8.0, overlay), GifOptions(width=80), tmp_path)
    assert result.bytes > 0


@needs_gifsicle
def test_fit_to_target_lowers_settings(sampled_video: Path, tmp_path: Path):
    base = GifOptions(fps=15, width=160)
    clip = Clip(sampled_video, 0, 8.0)
    full = estimate_size(clip, base, tmp_path).bytes
    result = fit_to_target(clip, base, full // 3, tmp_path)
    assert result.bytes <= full // 3
    assert result.options != base


@needs_gifsicle
def test_fit_to_target_keeps_settings_that_already_fit(sampled_video: Path, tmp_path: Path):
    base = GifOptions(width=80)
    result = fit_to_target(Clip(sampled_video, 0, 8.0), base, 50 * 1024 * 1024, tmp_path)
    assert result.options == base


@needs_gifsicle
def test_convert_to_target_fits(sampled_video: Path, tmp_path: Path):
    base = GifOptions(fps=15, width=160)
    clip = Clip(sampled_video, 0, 8.0)
    target = estimate_size(clip, base, tmp_path).bytes // 3
    dst = tmp_path / "out.gif"
    options = convert_to_target(clip, base, target, tmp_path, dst)
    assert dst.read_bytes()[:6] == b"GIF89a"
    assert dst.stat().st_size <= target
    assert options != base


@needs_gifsicle
def test_convert_to_target_reuses_exact_render(long_video: Path, tmp_path: Path):
    dst = tmp_path / "out.gif"
    options = convert_to_target(
        Clip(long_video, 0, 4.0), GifOptions(width=80), 10**8, tmp_path, dst
    )
    assert options == GifOptions(width=80)
    assert dst.exists()
    # The render made while estimating became the output.
    assert not list(tmp_path.glob("sample-10-80-256-0-*"))


@needs_gifsicle
def test_unreachable_target(sampled_video: Path, tmp_path: Path):
    with pytest.raises(TargetUnreachableError, match="cannot fit the file into 1 KB"):
        fit_to_target(Clip(sampled_video, 0, 8.0), GifOptions(), 1024, tmp_path)


def test_container_overhead_by_format():
    assert container_overhead(GifOptions(colors=64)) == gif_overhead(64)
    assert container_overhead(GifOptions(format=OutputFormat.WEBP)) < gif_overhead(256)
    assert container_overhead(GifOptions(format=OutputFormat.MP4)) > 0


def test_estimate_webp_samples(sampled_video: Path, tmp_path: Path):
    clip = Clip(src=sampled_video, start=0.0, length=8.0)
    estimate = estimate_size(clip, GifOptions(width=80, format=OutputFormat.WEBP), tmp_path)
    assert estimate.exact is False
    assert estimate.bytes > 0
    assert not list(tmp_path.glob("sample-*"))
