from dataclasses import replace
from pathlib import Path

import pytest

from app import main
from app.config import settings
from app.limits import JobSlots
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
    assert "Could not read video" in resp.json()["detail"]


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


def post_form(client, endpoint: str, video: Path, **fields):
    with video.open("rb") as f:
        return client.post(
            endpoint,
            files={"file": ("clip.mp4", f, "video/mp4")},
            data={k: str(v) for k, v in fields.items()},
        )


def test_presets_endpoint(client):
    presets = client.get("/api/presets").json()
    assert set(presets) == {"high", "medium", "low"}
    assert presets["low"]["width"] < presets["high"]["width"]


def test_convert_with_preset_reports_settings(client, sample_video: Path):
    resp = post_form(client, "/api/convert", sample_video, preset="low", width=100)
    assert resp.status_code == 200, resp.text
    assert resp.headers["x-gif-width"] == "100"
    assert resp.headers["x-gif-fps"] == "8"
    assert resp.headers["x-gif-colors"] == "64"
    assert int.from_bytes(resp.content[6:8], "little") == 100


@pytest.mark.parametrize(
    "fields",
    [{"preset": "ultra"}, {"colors": 1}, {"lossy": 500}, {"target_size_kb": 1}],
)
def test_convert_rejects_bad_compression_fields(client, sample_video: Path, fields):
    assert post_form(client, "/api/convert", sample_video, **fields).status_code == 422


def test_convert_to_target_size(client, sampled_video: Path):
    resp = post_form(client, "/api/convert", sampled_video, width=160, target_size_kb=100)
    assert resp.status_code == 200, resp.text
    assert len(resp.content) <= 100 * 1024
    assert int(resp.headers["x-gif-width"]) <= 160


def test_convert_to_unreachable_target(client, sampled_video: Path):
    resp = post_form(client, "/api/convert", sampled_video, target_size_kb=10)
    assert resp.status_code == 422
    assert "cannot fit the file into 10 KB" in resp.json()["detail"]


def test_estimate_matches_conversion(client, long_video: Path):
    est = post_form(client, "/api/estimate", long_video, preset="medium", start=1, end=3)
    assert est.status_code == 200, est.text
    body = est.json()
    assert body["exact"] is True
    assert body["duration"] == pytest.approx(2.0)
    assert body["settings"]["colors"] == 128
    gif = post_form(client, "/api/convert", long_video, preset="medium", start=1, end=3)
    assert body["estimated_bytes"] == len(gif.content)


def test_estimate_samples_long_clip(client, sampled_video: Path):
    body = post_form(client, "/api/estimate", sampled_video, width=120).json()
    assert body["exact"] is False
    assert body["duration"] == pytest.approx(8.0, abs=0.1)
    assert body["estimated_bytes"] > 0


def test_estimate_with_target_picks_settings(client, sampled_video: Path):
    body = post_form(client, "/api/estimate", sampled_video, width=160, target_size_kb=100).json()
    assert body["estimated_bytes"] <= 100 * 1024
    assert body["settings"]["width"] <= 160


@pytest.mark.parametrize("fields", [{"start": 10}, {"colors": 0}])
def test_estimate_rejects_bad_fields(client, long_video: Path, fields):
    assert post_form(client, "/api/estimate", long_video, **fields).status_code == 422


def test_estimate_rejects_garbage(client):
    resp = client.post("/api/estimate", files={"file": ("x.mp4", b"nope")})
    assert resp.status_code == 422


def test_convert_returns_503_when_busy(client, sample_video: Path, monkeypatch):
    monkeypatch.setattr(main, "job_slots", JobSlots(1))
    monkeypatch.setattr(main, "settings", replace(settings, job_wait_s=0))
    with main.job_slots.slot(0), sample_video.open("rb") as f:
        resp = client.post("/api/convert", files={"file": ("clip.mp4", f, "video/mp4")})
    assert resp.status_code == 503
    assert resp.headers["retry-after"] == "10"


def test_convert_rejects_clip_over_length_limit(client, long_video: Path, monkeypatch):
    monkeypatch.setattr(main, "settings", replace(settings, max_clip_seconds=2))
    resp = post_trim(client, long_video)
    assert resp.status_code == 422
    assert "limit is 2 s" in resp.json()["detail"]


def test_trimmed_clip_within_length_limit_passes(client, long_video: Path, monkeypatch):
    monkeypatch.setattr(main, "settings", replace(settings, max_clip_seconds=2))
    resp = post_trim(client, long_video, start=1, duration=2)
    assert resp.status_code == 200


def test_estimate_rejects_clip_over_length_limit(client, long_video: Path, monkeypatch):
    monkeypatch.setattr(main, "settings", replace(settings, max_clip_seconds=2))
    with long_video.open("rb") as f:
        resp = client.post("/api/estimate", files={"file": ("clip.mp4", f, "video/mp4")})
    assert resp.status_code == 422


def test_zero_disables_length_limit(client, long_video: Path, monkeypatch):
    monkeypatch.setattr(main, "settings", replace(settings, max_clip_seconds=0))
    assert post_trim(client, long_video).status_code == 200


@pytest.mark.parametrize(
    "output_format, media_type, magic",
    [("webp", "image/webp", b"WEBP"), ("mp4", "video/mp4", b"ftyp")],
)
def test_convert_to_other_formats(client, sample_video: Path, output_format, media_type, magic):
    resp = post_form(client, "/api/convert", sample_video, format=output_format, preset="low")
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == media_type
    assert f'filename="clip.{output_format}"' in resp.headers["content-disposition"]
    assert resp.content[8:12] == magic or resp.content[4:8] == magic


def test_convert_rejects_unknown_format(client, sample_video: Path):
    assert post_form(client, "/api/convert", sample_video, format="avi").status_code == 422


def test_estimate_matches_webp_conversion(client, long_video: Path):
    fields = {"format": "webp", "preset": "medium", "start": 1, "end": 3}
    body = post_form(client, "/api/estimate", long_video, **fields).json()
    assert body["exact"] is True
    webp = post_form(client, "/api/convert", long_video, **fields)
    assert body["estimated_bytes"] == len(webp.content)


def test_mp4_to_target_size(client, sampled_video: Path):
    resp = post_form(
        client, "/api/convert", sampled_video, format="mp4", width=160, target_size_kb=20
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.content) <= 20 * 1024
