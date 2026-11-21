from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import mount_frontend


def make_app(directory: Path | None) -> FastAPI:
    app = FastAPI()

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    mount_frontend(app, directory)
    return app


def test_serves_index_and_assets(tmp_path: Path):
    (tmp_path / "index.html").write_text("<h1>ui</h1>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    client = TestClient(make_app(tmp_path))

    assert client.get("/").text == "<h1>ui</h1>"
    assert client.get("/assets/app.js").text == "console.log(1)"
    assert client.get("/health").json() == {"status": "ok"}


def test_cache_headers(tmp_path: Path):
    (tmp_path / "index.html").write_text("<h1>ui</h1>")
    (tmp_path / "favicon.svg").write_text("<svg/>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app-1a2b3c.js").write_text("console.log(1)")
    client = TestClient(make_app(tmp_path))

    assert client.get("/").headers["cache-control"] == "no-cache"
    assert client.get("/favicon.svg").headers["cache-control"] == "no-cache"
    asset = client.get("/assets/app-1a2b3c.js")
    assert "immutable" in asset.headers["cache-control"]
    assert "cache-control" not in client.get("/assets/missing.js").headers


def test_without_frontend_root_is_404():
    client = TestClient(make_app(None))
    assert client.get("/").status_code == 404


def test_missing_directory_fails_fast(tmp_path: Path):
    with pytest.raises(RuntimeError):
        make_app(tmp_path / "missing")
