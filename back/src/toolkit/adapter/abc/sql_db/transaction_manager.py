from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from .connector import Connector


class Transaction(ABC):
    @property
    @abstractmethod
    def connection(self):
        pass

    @abstractmethod
    async def commit(self) -> None:
        pass

    @abstractmethod
    async def rollback(self) -> None:
        pass


class TransactionManager(ABC):
    @abstractmethod
    def __init__(self, connector: Connector):
        pass

    @abstractmethod
    @asynccontextmanager
    async def tx_context_manager(self) -> AsyncIterator:
        yield None

    @abstractmethod
    async def begin(self) -> Transaction:
        pass