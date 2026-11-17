from pathlib import Path

import pytest

from app.converter import GifOptions, TrimRange, build_command, convert_to_gif
from app.probe import probe_duration


@pytest.mark.parametrize(
    "kwargs",
    [
        {"start": -1},
        {"start": 2, "end": 2},
        {"start": 2, "end": 1},
        {"duration": 0},
        {"end": 2, "duration": 1},
        {"start": float("nan")},
        {"end": float("inf")},
    ],
)
def test_trim_validation(kwargs):
    with pytest.raises(ValueError):
        TrimRange(**kwargs)


def test_trim_length_from_end_or_duration():
    assert TrimRange(start=1, end=3).length == 2
    assert TrimRange(start=1, duration=2).stop == 3
    assert TrimRange(start=1).length is None
    assert TrimRange().is_full
    assert not TrimRange(start=1).is_full


@pytest.mark.parametrize(
    "trim, message",
    [
        (TrimRange(start=4), "start"),
        (TrimRange(start=5), "start"),
        (TrimRange(start=1, end=4.5), "past the end"),
        (TrimRange(start=3, duration=2), "past the end"),
    ],
)
def test_trim_must_fit_in_video(trim, message):
    with pytest.raises(ValueError, match=message):
        trim.check_within(4.0)


def test_trim_fits_in_video():
    TrimRange(start=1, end=4).check_within(4.0)
    TrimRange(start=1, end=4.02).check_within(4.0)  # rounding tolerance
    TrimRange(start=3.9).check_within(4.0)


def test_command_seeks_and_limits_length(tmp_path: Path):
    cmd = build_command(tmp_path / "in", tmp_path / "out.gif", GifOptions(), TrimRange(1.5, 3))
    assert cmd[cmd.index("-ss") + 1] == "1.500"
    assert cmd.index("-ss") < cmd.index("-i")
    assert cmd[cmd.index("-t") + 1] == "1.500"
    assert cmd.index("-t") > cmd.index("-i")


def test_command_without_trim(tmp_path: Path):
    cmd = build_command(tmp_path / "in", tmp_path / "out.gif", GifOptions(), TrimRange())
    assert "-ss" not in cmd and "-t" not in cmd


@pytest.mark.parametrize(
    "trim, expected",
    [
        (TrimRange(start=1, end=2.5), 1.5),
        (TrimRange(start=0.5, duration=1), 1.0),
        (TrimRange(start=3), 1.0),
    ],
)
def test_convert_trims_clip(long_video: Path, tmp_path: Path, trim, expected):
    out = convert_to_gif(long_video, tmp_path / "out.gif", GifOptions(fps=10, width=80), trim)
    assert probe_duration(out) == pytest.approx(expected, abs=0.15)
