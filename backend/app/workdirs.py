"""Per-request scratch directories."""

import shutil
import tempfile
import time
from pathlib import Path

PREFIX = "gif-"
# Far longer than any request can take, so live requests are never touched.
STALE_AFTER_S = 60 * 60


def new_workdir() -> Path:
    """A fresh directory in the system temp dir (``TMPDIR``)."""
    return Path(tempfile.mkdtemp(prefix=PREFIX))


def remove_stale_workdirs(
    root: Path | None = None, max_age_s: float = STALE_AFTER_S, now: float | None = None
) -> int:
    """Delete scratch directories a killed process left behind; returns how many."""
    root = root or Path(tempfile.gettempdir())
    cutoff = (now if now is not None else time.time()) - max_age_s
    removed = 0
    for path in root.glob(f"{PREFIX}*"):
        try:
            if path.is_dir() and not path.is_symlink() and path.stat().st_mtime < cutoff:
                shutil.rmtree(path, ignore_errors=True)
                removed += 1
        except OSError:
            continue
    return removed
