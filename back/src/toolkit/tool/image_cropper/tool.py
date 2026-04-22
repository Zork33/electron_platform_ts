from toolkit.abc.tool import Tool
from toolkit.adapter.abc.image_cropper.adapter import ImageCropper as ImageCropperAdapter
from toolkit.adapter.abc.image_cropper.config import ImageCropperConfig
from toolkit.adapter.abc.image_cropper.models import CropParams, CropResult


class ImageCropper(Tool):
    _code = "image_cropper"
    _title = "Image cropper"
    def __init__(self, cropper_adapter: ImageCropperAdapter):
        if cropper_adapter is None:
            raise ValueError("cropper_adapter cannot be None")
        self._cropper_adapter = cropper_adapter

    async def process_image(self, params: CropParams) -> CropResult:
        return await self._cropper_adapter.process_image(params)

    async def health_check(self) -> bool:
        try:
            if self._cropper_adapter is None:
                return False
            return await self._cropper_adapter.health_check()
        except Exception:
            return False

    @property
    def cropper_adapter(self) -> ImageCropperAdapter:
        return self._cropper_adapter

    @property
    def config(self) -> ImageCropperConfig:
        return self._cropper_adapter.config
