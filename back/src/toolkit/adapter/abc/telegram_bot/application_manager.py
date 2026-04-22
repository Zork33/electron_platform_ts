from abc import ABC, abstractmethod


class ApplicationManager(ABC):
    @abstractmethod
    def __init__(self, token: str):
        pass
    
    @property
    @abstractmethod
    def application(self) -> object:
        pass
    
    @abstractmethod
    def build_application(self) -> None:
        pass
    
    @abstractmethod
    async def start(self) -> None:
        pass
    
    @abstractmethod
    async def stop(self) -> None:
        pass
    
    @abstractmethod
    async def shutdown(self) -> None:
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        pass 