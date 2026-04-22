from dataclasses import dataclass
from typing import Literal


@dataclass
class CropParams:
    data: bytes
    filename: str | None = None
    max_width: int | None = None
    max_height: int | None = None
    fit_mode: Literal["contain", "cover"] = "contain"
    quality: int | None = None
    output_format: str | None = None


@dataclass
class CropResult:
    data: bytes
    ext: str
    mime_type: str
    width: int
    height: int
    size_bytes: int
