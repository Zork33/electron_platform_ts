from pydantic import Field

from toolkit.abc.config import Config


class ImageCropperConfig(Config):
    default_max_width: int = Field(default=1024, gt=0)
    default_max_height: int = Field(default=1024, gt=0)
    default_quality: int = Field(default=82, ge=1, le=100)
    default_output_format: str = Field(
        default="webp",
        pattern=r"^(?i)(jpeg|jpg|png|webp)$",
    )
    allow_upscale: bool = False
    max_input_bytes: int | None = Field(default=None, gt=0)
