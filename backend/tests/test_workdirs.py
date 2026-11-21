import os
from pathlib import Path

from app.workdirs import PREFIX, remove_stale_workdirs


def make_dir(root: Path, name: str, mtime: float) -> Path:
    path = root / name
    path.mkdir()
    (path / "input").write_bytes(b"x")
    os.utime(path, (mtime, mtime))
    return path


def test_removes_only_old_work_dirs(tmp_path: Path):
    now = 1_000_000.0
    old = make_dir(tmp_path, f"{PREFIX}old", now - 7200)
    fresh = make_dir(tmp_path, f"{PREFIX}fresh", now - 60)
    other = make_dir(tmp_path, "unrelated", now - 7200)

    assert remove_stale_workdirs(tmp_path, max_age_s=3600, now=now) == 1
    assert not old.exists()
    assert fresh.exists()
    assert other.exists()


def test_ignores_files_with_the_prefix(tmp_path: Path):
    stray = tmp_path / f"{PREFIX}file"
    stray.write_bytes(b"x")
    os.utime(stray, (0, 0))
    assert remove_stale_workdirs(tmp_path, max_age_s=1, now=1_000_000.0) == 0
    assert stray.exists()
