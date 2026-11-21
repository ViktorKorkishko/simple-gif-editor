"""Guards that keep one busy or abusive client from exhausting the server."""

import json
import threading
from collections.abc import Callable, Iterator
from contextlib import contextmanager

from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# Room for the form fields and multipart boundaries around the uploaded file.
FORM_OVERHEAD_BYTES = 1024 * 1024


RETRY_AFTER_S = 10


class JobSlots:
    """Caps how many conversions run at once.

    FFmpeg is CPU and memory heavy, so running every request in parallel
    slows all of them down and can run the server out of memory. Extra
    requests wait up to ``wait_s`` for a free slot, then get 503.
    """

    def __init__(self, size: int) -> None:
        self.size = size
        self._semaphore = threading.BoundedSemaphore(size)

    @contextmanager
    def slot(self, wait_s: float) -> Iterator[None]:
        if not self._semaphore.acquire(timeout=max(wait_s, 0)):
            raise HTTPException(
                status_code=503,
                detail="The server is busy with other conversions, try again shortly",
                headers={"Retry-After": str(RETRY_AFTER_S)},
            )
        try:
            yield
        finally:
            self._semaphore.release()


class BodyTooLargeError(HTTPException):
    def __init__(self, limit: int) -> None:
        super().__init__(status_code=413, detail=_too_large_detail(limit))


class BodySizeLimitMiddleware:
    """Answer 413 as soon as a request body grows past the limit.

    The multipart parser spools the whole upload to disk before the endpoint
    runs, so without this a client could fill the disk with one huge request.
    Requests with a ``Content-Length`` are refused before anything is read;
    chunked ones are cut off once they cross the limit.
    """

    def __init__(self, app: ASGIApp, max_bytes: Callable[[], int]) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        limit = self.max_bytes()
        declared = _content_length(scope)
        if declared is not None and declared > limit:
            await _send_413(send, limit)
            return

        received = 0
        started = False

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise BodyTooLargeError(limit)
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except BodyTooLargeError:
            if started:
                raise
            await _send_413(send, limit)


def _content_length(scope: Scope) -> int | None:
    for name, value in scope.get("headers", []):
        if name == b"content-length":
            try:
                return int(value)
            except ValueError:
                return None
    return None


def _too_large_detail(limit: int) -> str:
    mb = max(1, (limit - FORM_OVERHEAD_BYTES) // (1024 * 1024))
    return f"File is larger than {mb} MB"


async def _send_413(send: Send, limit: int) -> None:
    body = json.dumps({"detail": _too_large_detail(limit)}).encode()
    await send(
        {
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
                (b"connection", b"close"),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})
