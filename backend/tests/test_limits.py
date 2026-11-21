import threading
from typing import Annotated

import pytest
from fastapi import FastAPI, File, UploadFile
from fastapi.testclient import TestClient
from starlette.exceptions import HTTPException

from app.limits import BodySizeLimitMiddleware, JobSlots


def make_client(limit: int) -> tuple[TestClient, list[int]]:
    app = FastAPI()
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=lambda: limit)
    calls: list[int] = []

    @app.post("/upload")
    def upload(file: Annotated[UploadFile, File()]) -> dict[str, int]:
        size = len(file.file.read())
        calls.append(size)
        return {"size": size}

    return TestClient(app), calls


def test_small_body_passes():
    client, calls = make_client(10_000)
    resp = client.post("/upload", files={"file": ("x.bin", b"x" * 100)})
    assert resp.status_code == 200
    assert calls == [100]


def test_declared_length_over_limit_is_refused_before_the_endpoint():
    client, calls = make_client(1_000)
    resp = client.post("/upload", files={"file": ("x.bin", b"x" * 5_000)})
    assert resp.status_code == 413
    assert "larger than" in resp.json()["detail"]
    assert calls == []


def test_chunked_body_over_limit_is_cut_off():
    client, calls = make_client(1_000)

    boundary = "limit-test"

    def chunks():
        yield (
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="file"; filename="x.bin"\r\n'
            "Content-Type: application/octet-stream\r\n\r\n"
        ).encode()
        for _ in range(10):
            yield b"x" * 500
        yield f"\r\n--{boundary}--\r\n".encode()

    resp = client.post(
        "/upload",
        content=chunks(),
        headers={"content-type": f"multipart/form-data; boundary={boundary}"},
    )
    assert resp.status_code == 413
    assert calls == []


def test_requests_without_body_are_untouched():
    client, _ = make_client(1)
    assert client.get("/docs").status_code == 200


def test_job_slots_let_jobs_through_up_to_the_limit():
    slots = JobSlots(2)
    with slots.slot(0), slots.slot(0):
        pass
    with slots.slot(0):
        pass


def test_job_slots_refuse_when_full():
    slots = JobSlots(1)
    with slots.slot(0), pytest.raises(HTTPException) as exc_info, slots.slot(0.01):
        pass
    assert exc_info.value.status_code == 503
    assert exc_info.value.headers == {"Retry-After": "10"}
    with slots.slot(0):
        pass


def test_job_slots_wait_for_a_free_slot():
    slots = JobSlots(1)
    release = threading.Event()

    def hold() -> None:
        with slots.slot(0):
            release.wait()

    holder = threading.Thread(target=hold)
    holder.start()
    threading.Timer(0.05, release.set).start()
    with slots.slot(2):
        pass
    holder.join()
