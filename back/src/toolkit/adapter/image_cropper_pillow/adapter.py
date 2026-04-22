import io

from PIL import Image, ImageOps

from toolkit.abc.adapter import Adapter
from toolkit.adapter.abc.image_cropper.adapter import ImageCropper as AbstractImageCropper
from toolkit.adapter.abc.image_cropper.config import ImageCropperConfig
from toolkit.adapter.abc.image_cropper.models import CropParams, CropResult


class ImageCropperPillow(Adapter, AbstractImageCropper):
    _code = "pillow"
    _title = "Pillow"
    def __init__(self, config: ImageCropperConfig):
        if config is None:
            raise ValueError("config cannot be None")
        self._config = config

    @property
    def config(self) -> ImageCropperConfig:
        return self._config

    @staticmethod
    def _resolve_format(output_format: str) -> tuple[str, str, str]:
        fmt = output_format.lower()
        if fmt in {"jpg", "jpeg"}:
            return "JPEG", "jpg", "image/jpeg"
        if fmt == "png":
            return "PNG", "png", "image/png"
        if fmt == "webp":
            return "WEBP", "webp", "image/webp"
        raise ValueError(f"Unsupported output format: {output_format}")

    async def process_image(self, params: CropParams) -> CropResult:
        if params.data is None or len(params.data) == 0:
            raise ValueError("Image data is empty")

        max_input_bytes = self._config.max_input_bytes
        if max_input_bytes is not None and len(params.data) > max_input_bytes:
            raise ValueError(
                f"Input image is too large: {len(params.data)} bytes (limit: {max_input_bytes})"
            )

        max_width = params.max_width or self._config.default_max_width
        max_height = params.max_height or self._config.default_max_height
        quality = params.quality or self._config.default_quality
        output_format = params.output_format or self._config.default_output_format

        pil_format, ext, mime_type = self._resolve_format(output_format)

        try:
            image = Image.open(io.BytesIO(params.data))
            image = ImageOps.exif_transpose(image)
        except Exception as e:
            raise ValueError(f"Failed to read image: {e}") from e

        if params.fit_mode == "cover":
            image = ImageOps.fit(
                image,
                (max_width, max_height),
                method=Image.Resampling.LANCZOS
            )
        else:
            if self._config.allow_upscale:
                image = image.resize((max_width, max_height), Image.Resampling.LANCZOS)
            else:
                image.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

        if pil_format in {"JPEG"} and image.mode not in {"RGB", "L"}:
            image = image.convert("RGB")

        output = io.BytesIO()
        if pil_format in {"JPEG", "WEBP"}:
            image.save(output, format=pil_format, quality=quality, optimize=True)
        else:
            image.save(output, format=pil_format, optimize=True)

        data = output.getvalue()
        width, height = image.size

        return CropResult(
            data=data,
            ext=ext,
            mime_type=mime_type,
            width=width,
            height=height,
            size_bytes=len(data),
        )

    async def health_check(self) -> bool:
        try:
            image = Image.new("RGB", (1, 1), (255, 255, 255))
            output = io.BytesIO()
            image.save(output, format="PNG")
            return True
        except Exception:
            return False
