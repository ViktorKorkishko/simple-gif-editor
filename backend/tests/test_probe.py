from pathlib import Path

import pytest

from app.probe import ProbeError, probe_duration


def test_probe_duration(long_video: Path):
    assert probe_duration(long_video) == pytest.approx(4.0, abs=0.1)


def test_probe_rejects_non_video(tmp_path: Path):
    bogus = tmp_path / "bogus.mp4"
    bogus.write_bytes(b"definitely not a video")
    with pytest.raises(ProbeError):
        probe_duration(bogus)
