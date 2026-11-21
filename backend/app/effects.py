"""Colour and blur effects, each applied to a time range of the output.

The strength of every effect is ``amount`` from 0 to 100 and follows the CSS
filter the web UI previews it with, so the preview stays close to the result.
"""

import json
from dataclasses import dataclass, replace
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, TypeAdapter, ValidationError

from app.timing import check_time_range, enable_option, shift_range

MAX_EFFECTS = 10
MAX_AMOUNT = 100
# Blur radius at full strength, in output pixels (CSS blur(6px)).
MAX_BLUR_SIGMA = 6.0

# CSS sepia(1) colour matrix, rows for red, green and blue output.
_SEPIA = (
    (0.393, 0.769, 0.189),
    (0.349, 0.686, 0.168),
    (0.272, 0.534, 0.131),
)


class EffectType(StrEnum):
    GRAYSCALE = "grayscale"
    SEPIA = "sepia"
    BLUR = "blur"
    BRIGHTNESS = "brightness"
    CONTRAST = "contrast"
    SATURATION = "saturation"


def _number(value: float) -> str:
    return f"{value:.4g}"


@dataclass(frozen=True)
class Effect:
    """An effect over the whole output or the ``start``-``end`` seconds of it."""

    type: EffectType
    amount: int = MAX_AMOUNT
    start: float | None = None
    end: float | None = None

    def __post_init__(self) -> None:
        if not 0 <= self.amount <= MAX_AMOUNT:
            raise ValueError(f"effect amount must be between 0 and {MAX_AMOUNT}")
        check_time_range("effect", self.start, self.end)

    def to_filter(self) -> str | None:
        """The FFmpeg filter, or None when the effect changes nothing."""
        if self.amount == 0:
            return None
        a = self.amount / MAX_AMOUNT
        if self.type is EffectType.GRAYSCALE:
            name, options = "eq", [f"saturation={_number(1 - a)}"]
        elif self.type is EffectType.SATURATION:
            name, options = "eq", [f"saturation={_number(1 + a)}"]
        elif self.type is EffectType.CONTRAST:
            name, options = "eq", [f"contrast={_number(1 + 0.8 * a)}"]
        elif self.type is EffectType.BRIGHTNESS:
            k = _number(1 + 0.6 * a)
            name, options = "colorchannelmixer", [f"rr={k}", f"gg={k}", f"bb={k}"]
        elif self.type is EffectType.BLUR:
            name, options = "gblur", [f"sigma={_number(MAX_BLUR_SIGMA * a)}"]
        else:
            name, options = "colorchannelmixer", _sepia_options(a)
        return f"{name}=" + ":".join(options + enable_option(self.start, self.end))

    def shifted(self, offset: float, length: float) -> "Effect | None":
        """The effect for a piece of the output that starts ``offset`` seconds in."""
        shifted = shift_range(self.start, self.end, offset, length)
        if shifted is None:
            return None
        return replace(self, start=shifted[0], end=shifted[1])


def _sepia_options(a: float) -> list[str]:
    """colorchannelmixer options blending the identity matrix into sepia, like CSS."""
    options = []
    for row, out in zip(_SEPIA, "rgb", strict=True):
        for column, (value, src) in enumerate(zip(row, "rgb", strict=True)):
            identity = 1.0 if column == "rgb".index(out) else 0.0
            options.append(f"{out}{src}={_number(identity + (value - identity) * a)}")
    return options


class EffectSpec(BaseModel):
    """One entry of the ``effects`` form field, before range checks."""

    model_config = ConfigDict(extra="forbid")

    type: EffectType
    amount: int = MAX_AMOUNT
    start: float | None = None
    end: float | None = None


_EFFECTS = TypeAdapter(list[EffectSpec])


def parse_effects(raw: str) -> list[Effect]:
    """Effects from a JSON array; raises ``ValueError`` with a readable message."""
    try:
        specs = _EFFECTS.validate_python(json.loads(raw))
    except json.JSONDecodeError as exc:
        raise ValueError(f"effects must be a JSON array: {exc.msg}") from exc
    except ValidationError as exc:
        error = exc.errors()[0]
        where = ".".join(str(part) for part in error["loc"])
        raise ValueError(f"effects[{where}]: {error['msg']}" if where else error["msg"]) from exc
    if len(specs) > MAX_EFFECTS:
        raise ValueError(f"at most {MAX_EFFECTS} effects are allowed")
    effects = []
    for index, spec in enumerate(specs):
        try:
            effects.append(Effect(spec.type, spec.amount, spec.start, spec.end))
        except ValueError as exc:
            raise ValueError(f"effect {index + 1}: {exc}") from exc
    return effects
