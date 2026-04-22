from abc import abstractmethod

from toolkit.abc.abstract_adapter import AbstractAdapter

from .config import ImageCropperConfig
from .models import CropParams, CropResult


class ImageCropper(AbstractAdapter):
    _code = "image_cropper"
    _title = "Image cropper"
    @abstractmethod
    def __init__(self, config: ImageCropperConfig):
        pass

    @property
    @abstractmethod
    def config(self) -> ImageCropperConfig:
        pass

    @abstractmethod
    async def process_image(self, params: CropParams) -> CropResult:
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        pass
