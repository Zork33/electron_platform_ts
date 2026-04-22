from dataclasses import dataclass, field
from typing import Literal


@dataclass
class ImageProcessingSettings:
    output_format: str = "webp"
    max_width: int = 1920
    max_height: int = 1080
    quality: int = 82
    fit_mode: Literal["contain", "cover"] = "contain"


@dataclass
class VideoProcessingSettings:
    output_format: str = "mp4"
    max_width: int = 1920
    max_height: int = 1080
    max_duration_seconds: int | None = None


@dataclass
class ImageSettings:
    allowed_extensions: set[str] = field(
        default_factory=lambda: {'jpg', 'jpeg', 'png', 'webp', 'gif'}
    )
    processing: ImageProcessingSettings | None = None


@dataclass
class VideoSettings:
    allowed_extensions: set[str] = field(
        default_factory=lambda: {'mp4', 'webm', 'mov'}
    )
    processing: VideoProcessingSettings | None = None


@dataclass
class AudioSettings:
    allowed_extensions: set[str] = field(
        default_factory=lambda: {'mp3', 'wav', 'ogg'}
    )


@dataclass
class AnyFileSettings:
    allowed_extensions: set[str] | None = None


@dataclass
class FileSettings:
    image: ImageSettings | None = None
    video: VideoSettings | None = None
    audio: AudioSettings | None = None
    any: AnyFileSettings | None = None
