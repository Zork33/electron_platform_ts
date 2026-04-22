from abc import abstractmethod

from toolkit.abc.abstract_adapter import AbstractAdapter

from .part_manager import PartManager
from .filer import Filer


class FileStorage(AbstractAdapter):
    _code = "file_storage"
    _title = "File storage"
    PartManager = PartManager
    Filer = Filer
    
    @abstractmethod
    def __init__(
        self,
        host: str,
        port: int,
        login: str,
        password: str,
        use_ssl: bool = False
    ):
        pass
    
    @property
    @abstractmethod
    def part_manager(self) -> PartManager:
        pass
    
    @property
    @abstractmethod
    def filer(self) -> Filer:
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        pass
