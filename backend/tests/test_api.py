from pathlib import Path

import pytest

from app.config import settings
from app.probe import probe_duration


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


def post_trim(client, video: Path, **fields):
    with video.open("rb") as f:
        return client.post(
            "/api/convert",
            files={"file": ("clip.mp4", f, "video/mp4")},
            data={"fps": "10", "width": "80", **{k: str(v) for k, v in fields.items()}},
        )


def test_convert_with_start_and_end(client, long_video: Path, tmp_path: Path):
    resp = post_trim(client, long_video, start=1, end=2.5)
    assert resp.status_code == 200, resp.text
    gif = tmp_path / "out.gif"
    gif.write_bytes(resp.content)
    assert probe_duration(gif) == pytest.approx(1.5, abs=0.15)


def test_convert_with_start_and_duration(client, long_video: Path, tmp_path: Path):
    resp = post_trim(client, long_video, start=2, duration=1)
    assert resp.status_code == 200, resp.text
    gif = tmp_path / "out.gif"
    gif.write_bytes(resp.content)
    assert probe_duration(gif) == pytest.approx(1.0, abs=0.15)


@pytest.mark.parametrize(
    "fields, message",
    [
        ({"start": 5}, "less than the video duration"),
        ({"start": 1, "end": 6}, "past the end of the video"),
        ({"start": 3, "duration": 2}, "past the end of the video"),
        ({"start": 2, "end": 1}, "end must be greater than start"),
        ({"end": 2, "duration": 1}, "either end or duration"),
    ],
)
def test_convert_rejects_bad_trim(client, long_video: Path, fields, message):
    resp = post_trim(client, long_video, **fields)
    assert resp.status_code == 422
    assert message in resp.json()["detail"]


@pytest.mark.parametrize("fields", [{"start": -1}, {"duration": 0}, {"end": "abc"}])
def test_convert_rejects_invalid_trim_values(client, long_video: Path, fields):
    assert post_trim(client, long_video, **fields).status_code == 422


def test_convert_trim_on_garbage(client):
    resp = client.post("/api/convert", files={"file": ("x.mp4", b"nope")}, data={"start": "1"})
    assert resp.status_code == 422
    assert "Could not read video" in resp.json()["detail"]


def test_convert_with_text(client, long_video: Path):
    resp = post_trim(
        client,
        long_video,
        start=1,
        end=3,
        text="Привіт!",
        text_size=20,
        text_color="#ffcc00",
        text_position="top-left",
        text_box="true",
        text_start=0.5,
        text_end=1.5,
    )
    assert resp.status_code == 200, resp.text
    assert resp.content[:6] == b"GIF89a"


def test_convert_with_text_at_offset(client, sample_video: Path):
    resp = post_trim(client, sample_video, text="hi", text_x=5, text_y=5, text_outline=0)
    assert resp.status_code == 200, resp.text


def test_convert_ignores_blank_text(client, sample_video: Path):
    resp = post_trim(client, sample_video, text="  ", text_x=5)
    assert resp.status_code == 200, resp.text


@pytest.mark.parametrize(
    "fields, message",
    [
        ({"text_color": "red:x=0"}, "text color"),
        ({"text_box_color": "black@3"}, "box color"),
        ({"text_x": 10}, "both x and y"),
        ({"text_start": 2, "text_end": 1}, "text end must be greater"),
    ],
)
def test_convert_rejects_bad_text_options(client, sample_video: Path, fields, message):
    resp = post_trim(client, sample_video, text="hi", **fields)
    assert resp.status_code == 422
    assert message in resp.json()["detail"]


@pytest.mark.parametrize(
    "fields",
    [
        {"text_position": "left"},
        {"text_size": 1},
        {"text_outline": 50},
        {"text": "x" * 501},
    ],
)
def test_convert_rejects_out_of_range_text_fields(client, sample_video: Path, fields):
    resp = post_trim(client, sample_video, **{"text": "hi", **fields})
    assert resp.status_code == 422
