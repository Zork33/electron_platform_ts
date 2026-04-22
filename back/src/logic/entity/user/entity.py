from datetime import datetime
from pathlib import Path

from logic.abc.presets.entity import Entity
from data_framework.storage_settings import StorageSettings
from data_framework.mixins.file_mixin import FileMixinSettings
from toolkit.adapter.abc.image_cropper.models import CropParams
from data_framework.file_descriptor.descriptor import FileDescriptor
from data_framework.file_descriptor.file_settings import FileSettings, ImageSettings
from toolkit.tool.file_manager.tool import FileManager
from toolkit.tool.image_cropper.tool import ImageCropper
from storage_schemas.file_storage.main.parts.public import PUBLIC
from .storage import UserStorage


class User(Entity):
    _storage_settings = StorageSettings(storage_class=UserStorage)
    _file_mixin_settings = FileMixinSettings()

    auth_email: str | None = None
    auth_telegram_id: str | None = None
    person_id: int | None = None
    has_access: bool = False
    auth_session_expires_at: datetime | None = None
    is_admin: bool = False
    avatar_id: int | None = None

    avatar = FileDescriptor(
        type=FileDescriptor.Type.FILE,
        fk_column="avatar_id",
        storage_part=PUBLIC,
        storage_path_template="user/{id}/avatar",
        file_settings=FileSettings(
            image=ImageSettings(allowed_extensions={'jpg', 'jpeg', 'png', 'webp'}),
        ),
        include_in_get=True,
        include_in_get_list=True,
        delete_on_delete=False,
        delete_on_hard_delete=True,
    )

    @classmethod
    async def get_by_auth_email(cls, email: str, tx=None):
        storage = cls._get_storage()
        data = await storage.get_by_auth_email(email, tx=tx)
        if data:
            instance = cls._create_instance()
            instance._populate_from_data(data)
            return instance
        return None

    @classmethod
    def _get_file_manager(cls) -> FileManager:
        return FileManager.get_from_container("file_manager")

    @classmethod
    def _get_image_cropper(cls) -> ImageCropper:
        return ImageCropper.get_from_container("image_cropper")

    @classmethod
    def _resolve_avatar_extension(cls, file) -> str:
        filename = getattr(file, "filename", None) or ""
        ext = Path(filename).suffix.lower().lstrip(".")
        if not ext:
            raise ValueError("Не удалось определить расширение файла")
        return ext

    @classmethod
    def _validate_avatar_extension(cls, ext: str) -> None:
        allowed = cls.avatar.allowed_extensions
        if ext.lower() not in allowed:
            raise ValueError(
                f"Недопустимое расширение файла: {ext}. Разрешено: {', '.join(sorted(allowed))}"
            )

    @classmethod
    async def _prepare_avatar_payload(
        cls,
        user_id: int,
        file
    ) -> tuple[bytes, str, str]:
        source_ext = cls._resolve_avatar_extension(file)
        cls._validate_avatar_extension(source_ext)

        source_bytes = await file.read()
        if not source_bytes:
            raise ValueError("Файл пустой")

        cropper = cls._get_image_cropper()
        crop_result = await cropper.process_image(
            CropParams(
                data=source_bytes,
                filename=getattr(file, "filename", None),
                fit_mode="contain",
            )
        )

        cls._validate_avatar_extension(crop_result.ext)
        filename = f"avatar_{user_id}"
        return crop_result.data, crop_result.ext, filename

    @classmethod
    async def upload_avatar(cls, user_id: int, file, tx=None):
        file_manager = cls._get_file_manager()
        storage = cls._get_storage()
        async with cls._ensure_transaction(tx, cls._get_db_client()) as active_tx:
            user_data = await storage.get(user_id, tx=active_tx)
            if not user_data:
                raise LookupError("User not found")

            payload, ext, filename = await cls._prepare_avatar_payload(user_id, file)
            path = f"{cls.avatar.storage_path_template.format(id=user_id)}/{filename}.{ext}"

            metadata = await file_manager.upload(
                file=payload,
                storage_part=cls.avatar.storage_part,
                path=path,
                filename=filename,
                ext=ext,
                with_replace=True,
                tx=active_tx,
            )

            previous_avatar_id = user_data.get("avatar_id")
            updated_data = await storage.update(user_id, {"avatar_id": metadata["id"]}, tx=active_tx)
            if not updated_data:
                raise RuntimeError("Failed to update user avatar")

            if previous_avatar_id and previous_avatar_id != metadata["id"]:
                await file_manager.hard_delete(previous_avatar_id, tx=active_tx)

        return await cls.get(user_id)

    @classmethod
    async def replace_avatar(cls, user_id: int, file, tx=None):
        return await cls.upload_avatar(user_id=user_id, file=file, tx=tx)

    @classmethod
    async def delete_avatar(cls, user_id: int, tx=None):
        file_manager = cls._get_file_manager()
        storage = cls._get_storage()
        async with cls._ensure_transaction(tx, cls._get_db_client()) as active_tx:
            user_data = await storage.get(user_id, tx=active_tx)
            if not user_data:
                raise LookupError("User not found")

            avatar_id = user_data.get("avatar_id")
            updated_data = await storage.update(user_id, {"avatar_id": None}, tx=active_tx)
            if not updated_data:
                raise RuntimeError("Failed to clear user avatar")

            if avatar_id:
                await file_manager.delete(avatar_id, tx=active_tx)

        return await cls.get(user_id)

    @classmethod
    async def get_avatar_content(cls, user_id: int, tx=None) -> tuple[bytes, dict]:
        file_manager = cls._get_file_manager()
        storage = cls._get_storage()
        user_data = await storage.get(user_id, tx=tx)
        if not user_data:
            raise LookupError("User not found")

        avatar_id = user_data.get("avatar_id")
        if not avatar_id:
            raise FileNotFoundError("Avatar not found")

        metadata = await file_manager.get(avatar_id, tx=tx)
        if not metadata:
            raise FileNotFoundError("Avatar metadata not found")

        content = await file_manager.download(avatar_id, tx=tx)
        if content is None:
            raise FileNotFoundError("Avatar content not found")

        return content, metadata
