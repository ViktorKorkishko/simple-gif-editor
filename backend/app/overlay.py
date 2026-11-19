"""Text overlay rendered with FFmpeg's ``drawtext`` filter."""

import math
import re
from dataclasses import dataclass, replace
from enum import StrEnum
from pathlib import Path

MAX_TEXT_LENGTH = 500
MIN_FONT_SIZE, MAX_FONT_SIZE = 8, 200
MAX_OUTLINE = 10
MAX_OFFSET = 4000
# Gap between the text and the edge of the frame for the position presets, in px.
EDGE_MARGIN = 10
# Padding around the text inside the background box, in px.
BOX_PADDING = 6

# "#RRGGBB", "#RRGGBBAA" or a plain colour name (white, black, red, ...),
# optionally followed by "@opacity" from 0 to 1, e.g. "black@0.5".
_COLOR_RE = re.compile(
    r"^(?:#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?|[a-zA-Z]{3,30})(?:@(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?))?$"
)
# Control characters other than tab and line breaks cannot be drawn.
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class TextPosition(StrEnum):
    TOP = "top"
    CENTER = "center"
    BOTTOM = "bottom"
    TOP_LEFT = "top-left"
    TOP_RIGHT = "top-right"
    BOTTOM_LEFT = "bottom-left"
    BOTTOM_RIGHT = "bottom-right"


_LEFT = str(EDGE_MARGIN)
_HCENTER = "(w-text_w)/2"
_RIGHT = f"w-text_w-{EDGE_MARGIN}"
_TOP = str(EDGE_MARGIN)
_VCENTER = "(h-text_h)/2"
_BOTTOM = f"h-text_h-{EDGE_MARGIN}"

_PRESETS: dict[TextPosition, tuple[str, str]] = {
    TextPosition.TOP: (_HCENTER, _TOP),
    TextPosition.CENTER: (_HCENTER, _VCENTER),
    TextPosition.BOTTOM: (_HCENTER, _BOTTOM),
    TextPosition.TOP_LEFT: (_LEFT, _TOP),
    TextPosition.TOP_RIGHT: (_RIGHT, _TOP),
    TextPosition.BOTTOM_LEFT: (_LEFT, _BOTTOM),
    TextPosition.BOTTOM_RIGHT: (_RIGHT, _BOTTOM),
}


def is_valid_color(value: str) -> bool:
    return bool(_COLOR_RE.match(value))


def _check_color(name: str, value: str) -> None:
    if not is_valid_color(value):
        raise ValueError(
            f"{name} must be a colour name or #RRGGBB / #RRGGBBAA, optionally with "
            f"@opacity (e.g. black@0.5); got {value!r}"
        )


def escape_filter_value(value: str) -> str:
    """Escape a value so it survives as one ``key=value`` option in a filtergraph.

    FFmpeg parses filtergraphs in two passes: the graph level splits on ``,;[]``
    and the filter level splits options on ``:``. Both treat ``\\`` and ``'`` as
    special, so the value is escaped for the option level first and the graph
    level second. Needed for file paths such as ``C:\\fonts\\a.ttf``.
    """
    option_level = re.sub(r"([\\':])", r"\\\1", value)
    return re.sub(r"([\\'\[\],;])", r"\\\1", option_level)


@dataclass(frozen=True)
class TextOverlay:
    """Caption drawn on every frame (or a time range) of the GIF.

    Sizes and offsets are in pixels of the output GIF. ``x``/``y`` override the
    position preset and must be given together. ``start``/``end`` are seconds
    from the start of the GIF (after trimming); without them the text is shown
    the whole time.
    """

    text: str
    font_size: int = 32
    color: str = "white"
    position: TextPosition = TextPosition.BOTTOM
    x: int | None = None
    y: int | None = None
    outline: int = 2
    outline_color: str = "black"
    box: bool = False
    box_color: str = "black@0.5"
    start: float | None = None
    end: float | None = None

    def __post_init__(self) -> None:
        if not self.text.strip():
            raise ValueError("text must not be empty")
        if len(self.text) > MAX_TEXT_LENGTH:
            raise ValueError(f"text must be at most {MAX_TEXT_LENGTH} characters")
        if _CONTROL_RE.search(self.text):
            raise ValueError("text must not contain control characters")
        if not MIN_FONT_SIZE <= self.font_size <= MAX_FONT_SIZE:
            raise ValueError(f"font size must be between {MIN_FONT_SIZE} and {MAX_FONT_SIZE}")
        if not 0 <= self.outline <= MAX_OUTLINE:
            raise ValueError(f"outline must be between 0 and {MAX_OUTLINE}")
        _check_color("text color", self.color)
        _check_color("outline color", self.outline_color)
        _check_color("box color", self.box_color)
        if (self.x is None) != (self.y is None):
            raise ValueError("pass both x and y, or neither")
        for name, offset in (("x", self.x), ("y", self.y)):
            if offset is not None and not 0 <= offset <= MAX_OFFSET:
                raise ValueError(f"{name} must be between 0 and {MAX_OFFSET}")
        for name, t in (("text start", self.start), ("text end", self.end)):
            if t is not None and (not math.isfinite(t) or t < 0):
                raise ValueError(f"{name} must be a non-negative number")
        if self.start is not None and self.end is not None and self.end <= self.start:
            raise ValueError("text end must be greater than text start")

    @property
    def coordinates(self) -> tuple[str, str]:
        """``x`` and ``y`` expressions for drawtext."""
        if self.x is not None and self.y is not None:
            return str(self.x), str(self.y)
        return _PRESETS[self.position]

    @property
    def enable_expression(self) -> str | None:
        """drawtext ``enable`` expression for the time range, if one is set."""
        if self.start is None and self.end is None:
            return None
        if self.end is None:
            return f"gte(t,{self.start:g})"
        if self.start is None:
            return f"lt(t,{self.end:g})"
        return f"between(t,{self.start:g},{self.end:g})"

    def to_filter(self, text_file: Path, font_file: Path) -> str:
        """Build the drawtext filter.

        The text itself is read from ``text_file`` with expansion turned off, so
        user input never becomes part of the filtergraph and needs no escaping.
        """
        x, y = self.coordinates
        options = [
            f"fontfile={escape_filter_value(str(font_file))}",
            f"textfile={escape_filter_value(str(text_file))}",
            "expansion=none",
            f"fontsize={self.font_size}",
            f"fontcolor={self.color}",
            f"x={x}",
            f"y={y}",
        ]
        if self.outline:
            options += [f"borderw={self.outline}", f"bordercolor={self.outline_color}"]
        if self.box:
            options += ["box=1", f"boxcolor={self.box_color}", f"boxborderw={BOX_PADDING}"]
        enable = self.enable_expression
        if enable is not None:
            # The commas inside the expression would otherwise split the graph.
            options.append(f"enable='{enable}'")
        return "drawtext=" + ":".join(options)

    def shifted(self, offset: float, length: float) -> "TextOverlay | None":
        """The overlay for a piece of the GIF that starts ``offset`` seconds in.

        Used to render short samples of a longer GIF. Returns ``None`` when the
        text is not visible during the ``length`` seconds of that piece.
        """
        if self.start is None and self.end is None:
            return self
        start = (self.start or 0.0) - offset
        end = None if self.end is None else self.end - offset
        if start >= length or (end is not None and end <= 0):
            return None
        return replace(self, start=start if start > 0 else None, end=end)

    def write_text_file(self, path: Path) -> Path:
        """Save the text for drawtext's ``textfile`` option (UTF-8, LF newlines)."""
        path.write_text(self.text.replace("\r\n", "\n").replace("\r", "\n"), encoding="utf-8")
        return path
