import os

from toolkit.adapter.abc.image_cropper.config import ImageCropperConfig


def crop_config() -> ImageCropperConfig:
    max_input_bytes_raw = os.environ.get("IMAGE_CROPPER_MAX_INPUT_BYTES")
    max_input_bytes = int(max_input_bytes_raw) if max_input_bytes_raw else None

    return ImageCropperConfig(
        default_max_width=int(os.environ.get("IMAGE_CROPPER_DEFAULT_MAX_WIDTH", "1024")),
        default_max_height=int(os.environ.get("IMAGE_CROPPER_DEFAULT_MAX_HEIGHT", "1024")),
        default_quality=int(os.environ.get("IMAGE_CROPPER_DEFAULT_QUALITY", "82")),
        default_output_format=os.environ.get("IMAGE_CROPPER_DEFAULT_OUTPUT_FORMAT", "webp"),
        allow_upscale=os.environ.get("IMAGE_CROPPER_ALLOW_UPSCALE", "false").lower() == "true",
        max_input_bytes=max_input_bytes,
    )
