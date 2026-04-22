from __future__ import annotations

from functools import cached_property
from pathlib import Path
from typing import TYPE_CHECKING

from data_framework.file_collection import FileCollection
from data_framework.file_descriptor.file_settings import ImageProcessingSettings
from toolkit.tool.image_cropper.tool import ImageCropper
from toolkit.adapter.abc.image_cropper.models import CropParams

if TYPE_CHECKING:
    from data_framework.crud_element import CrudElement
    from data_framework.file_descriptor.descriptor import FileDescriptor


class _UploadProxy:
    """Обёртка над обработанными байтами для передачи в FileCollection.upload."""

    def __init__(self, original_filename: str, content: bytes, ext: str, content_type: str | None = None):
        stem = Path(original_filename).stem
        self.filename = f"{stem}.{ext}"
        self._content = content
        self.content_type = content_type

    async def read(self) -> bytes:
        return self._content


class MediaCollection(FileCollection):
    """Расширяет FileCollection медиа-операциями: обработка изображений, конвертация, AI (фаза 2)."""

    @cached_property
    def _image_cropper(self) -> ImageCropper:
        return ImageCropper.get_from_container("image_cropper")

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _image_exts(self) -> set[str]:
        settings = self._descriptor.file_settings
        if settings and settings.image:
            return settings.image.allowed_extensions
        return set()

    def _build_crop_params(
        self,
        data: bytes,
        filename: str,
        processing: ImageProcessingSettings,
        **overrides,
    ) -> CropParams:
        return CropParams(
            data=data,
            filename=filename,
            max_width=overrides.get("max_width", processing.max_width),
            max_height=overrides.get("max_height", processing.max_height),
            fit_mode=overrides.get("fit_mode", processing.fit_mode),
            quality=overrides.get("quality", processing.quality),
            output_format=overrides.get("output_format", processing.output_format),
        )

    # ─── Загрузка с обработкой ────────────────────────────────────────────────

    async def upload(self, file, *, process: bool | None = None, **overrides) -> dict:
        settings = self._descriptor.file_settings
        image_processing = settings.image.processing if (settings and settings.image) else None

        should_process = process if process is not None else (image_processing is not None)

        if not should_process or not image_processing:
            return await super().upload(file, **overrides)

        filename_str = getattr(file, "filename", None) or ""
        ext = Path(filename_str).suffix.lower().lstrip(".")

        if ext not in self._image_exts():
            return await super().upload(file, **overrides)

        raw_bytes = file if isinstance(file, bytes) else await file.read()

        params = self._build_crop_params(raw_bytes, filename_str, image_processing, **overrides)
        result = await self._image_cropper.process_image(params)

        proxy = _UploadProxy(filename_str, result.data, result.ext, result.mime_type)
        return await super().upload(proxy, **overrides)

    # ─── Конвертация ──────────────────────────────────────────────────────────

    async def convert(self, stored_file_id: int, target_format: str, **overrides) -> dict:
        item = await self.get_item(stored_file_id)
        if item is None:
            raise ValueError(f"Файл {stored_file_id} не найден в коллекции")

        raw_bytes = await self._file_manager.download(stored_file_id)
        if raw_bytes is None:
            raise ValueError(f"Не удалось скачать файл {stored_file_id}")

        settings = self._descriptor.file_settings
        image_processing = settings.image.processing if (settings and settings.image) else None
        base_processing = image_processing or ImageProcessingSettings()

        merged = {"output_format": target_format, **overrides}
        params = self._build_crop_params(
            raw_bytes,
            item.get("filename", ""),
            base_processing,
            **merged,
        )
        result = await self._image_cropper.process_image(params)

        return await self._file_manager.replace(
            stored_file_id,
            result.data,
            content_type=result.mime_type,
        )

    # ─── AI (фаза 2, заглушки) ────────────────────────────────────────────────

    async def ai_edit(self, stored_file_id: int, prompt: str, **kwargs) -> dict:
        raise NotImplementedError("AI-редактирование будет доступно в фазе 2")

    async def ai_generate(self, prompt: str, reference_ids: list[int] | None = None, **kwargs) -> dict:
        raise NotImplementedError("AI-генерация будет доступна в фазе 2")
