from abc import abstractmethod

from toolkit.abc.abstract_tool import AbstractTool
from toolkit.tool.file_storage.filer import Filer
from toolkit.tool.file_storage.part_manager import PartManager


class FileStorage(AbstractTool):
    _code = "file_storage"
    _title = "File storage"

    @property
    @abstractmethod
    def filer(self) -> Filer:
        pass

    @property
    @abstractmethod
    def part_manager(self) -> PartManager:
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        pass
