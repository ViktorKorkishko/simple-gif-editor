"""Time ranges for filters that apply to part of the output."""

import math

# A time range in seconds from the start of the output; None means open-ended.
TimeRange = tuple[float | None, float | None]


def check_time_range(name: str, start: float | None, end: float | None) -> None:
    """Raise ``ValueError`` unless ``start``/``end`` form a valid range."""
    for label, t in ((f"{name} start", start), (f"{name} end", end)):
        if t is not None and (not math.isfinite(t) or t < 0):
            raise ValueError(f"{label} must be a non-negative number")
    if start is not None and end is not None and end <= start:
        raise ValueError(f"{name} end must be greater than {name} start")


def enable_expression(start: float | None, end: float | None) -> str | None:
    """FFmpeg timeline ``enable`` expression for the range, or None for always."""
    if start is None and end is None:
        return None
    if end is None:
        return f"gte(t,{start:g})"
    if start is None:
        return f"lt(t,{end:g})"
    return f"between(t,{start:g},{end:g})"


def enable_option(start: float | None, end: float | None) -> list[str]:
    """``enable='...'`` filter option for the range, quoted so its commas survive."""
    expression = enable_expression(start, end)
    return [] if expression is None else [f"enable='{expression}'"]


def shift_range(
    start: float | None, end: float | None, offset: float, length: float
) -> TimeRange | None:
    """The range as seen by a piece of the output that starts ``offset`` seconds in.

    Returns None when the range does not overlap the ``length`` seconds of that piece.
    """
    if start is None and end is None:
        return (None, None)
    new_start = (start or 0.0) - offset
    new_end = None if end is None else end - offset
    if new_start >= length or (new_end is not None and new_end <= 0):
        return None
    return (new_start if new_start > 0 else None, new_end)
