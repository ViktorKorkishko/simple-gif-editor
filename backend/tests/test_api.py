from pathlib import Path

from app.config import settings


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_convert_returns_gif(client, sample_video: Path):
    with sample_video.open("rb") as f:
        resp = client.post(
            "/api/convert",
            files={"file": ("clip.mp4", f, "video/mp4")},
            data={"fps": "5", "width": "100"},
        )
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "image/gif"
    assert 'filename="clip.gif"' in resp.headers["content-disposition"]
    assert resp.content[:6] == b"GIF89a"
    assert int.from_bytes(resp.content[6:8], "little") == 100


def test_convert_rejects_invalid_params(client, sample_video: Path):
    with sample_video.open("rb") as f:
        resp = client.post("/api/convert", files={"file": ("clip.mp4", f)}, data={"fps": "99"})
    assert resp.status_code == 422


def test_convert_rejects_garbage(client, sample_video: Path):
    resp = client.post("/api/convert", files={"file": ("x.mp4", b"not a video")})
    assert resp.status_code == 422
    assert "Could not convert" in resp.json()["detail"]


def test_convert_rejects_empty(client):
    resp = client.post("/api/convert", files={"file": ("x.mp4", b"")})
    assert resp.status_code == 400


def test_convert_rejects_too_large(client, monkeypatch):
    monkeypatch.setattr(type(settings), "max_upload_bytes", property(lambda self: 10))
    resp = client.post("/api/convert", files={"file": ("x.mp4", b"x" * 100)})
    assert resp.status_code == 413
