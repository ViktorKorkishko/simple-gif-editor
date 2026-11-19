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
    font_file: Path = Path(os.getenv("FONT_FILE", str(DEFAULT_FONT)))

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


settings = Settings()
