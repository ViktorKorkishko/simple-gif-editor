"""Runtime settings, overridable through environment variables."""

import os
from dataclasses import dataclass
from pathlib import Path

DEFAULT_FONT = Path(__file__).parent / "fonts" / "DejaVuSans-Bold.ttf"


@dataclass(frozen=True)
class Settings:
    ffmpeg_bin: str = os.getenv("FFMPEG_BIN", "ffmpeg")
    ffprobe_bin: str = os.getenv("FFPROBE_BIN", "ffprobe")
    gifsicle_bin: str = os.getenv("GIFSICLE_BIN", "gifsicle")
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "100"))
    ffmpeg_timeout_s: int = int(os.getenv("FFMPEG_TIMEOUT_S", "120"))
    max_concurrent_jobs: int = int(os.getenv("MAX_CONCURRENT_JOBS", "2"))
    job_wait_s: float = float(os.getenv("JOB_WAIT_S", "30"))
    font_file: Path = Path(os.getenv("FONT_FILE", str(DEFAULT_FONT)))
    frontend_dir: Path | None = (
        Path(os.environ["FRONTEND_DIR"]) if os.getenv("FRONTEND_DIR") else None
    )

    def __post_init__(self) -> None:
        if self.max_concurrent_jobs < 1:
            raise ValueError("MAX_CONCURRENT_JOBS must be at least 1")

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


settings = Settings()
