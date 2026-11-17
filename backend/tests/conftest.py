import shutil
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app


def make_test_clip(dst: Path, seconds: int) -> Path:
    """Write a tiny 160x120 25 fps test pattern of the given length."""
    if shutil.which("ffmpeg") is None:
        pytest.skip("ffmpeg not installed")
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"testsrc=duration={seconds}:size=160x120:rate=25",
            "-pix_fmt",
            "yuv420p",
            str(dst),
        ],
        check=True,
    )
    return dst


@pytest.fixture(scope="session")
def sample_video(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A 1-second clip."""
    return make_test_clip(tmp_path_factory.mktemp("fixtures") / "sample.mp4", 1)


@pytest.fixture(scope="session")
def long_video(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A 4-second clip, for trimming."""
    return make_test_clip(tmp_path_factory.mktemp("fixtures") / "long.mp4", 4)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
