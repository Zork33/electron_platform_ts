from contextlib import asynccontextmanager
from types import TracebackType

from toolkit.adapter.abc.sql_db.adapter import SqlDb
from toolkit.adapter.abc.sql_db.transaction_manager import Transaction


class AutoTransaction:
    def __init__(self, tx: Transaction):
        self._tx = tx
        self.connection = tx.connection
        self._completed = False

    async def _commit(self) -> None:
        if not self._completed:
            await self._tx.commit()
            self._completed = True

    async def _rollback(self) -> None:
        if not self._completed:
            await self._tx.rollback()
            self._completed = True

    async def __aenter__(self) -> "AutoTransaction":
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None
    ) -> None:
        if exc_type is not None:
            await self._rollback()
        else:
            await self._commit()


class ManualTransaction:
    def __init__(self, tx: Transaction):
        self._tx = tx
        self.connection = tx.connection
        self._completed = False

    async def commit(self) -> None:
        if self._completed:
            raise RuntimeError("Транзакция уже завершена")
        await self._tx.commit()
        self._completed = True

    async def rollback(self) -> None:
        if self._completed:
            raise RuntimeError("Транзакция уже завершена")
        await self._tx.rollback()
        self._completed = True


class TransactionManager:
    def __init__(self, client_adapter: SqlDb):
        if client_adapter is None:
            raise ValueError("Адаптер клиента (client_adapter) не может быть None")
        self._client_adapter = client_adapter

    @asynccontextmanager
    async def transaction(self):
        tx = await self._client_adapter.transaction_manager.begin()
        auto_tx = AutoTransaction(tx)
        async with auto_tx:
            yield auto_tx

    async def begin(self) -> ManualTransaction:
        tx = await self._client_adapter.transaction_manager.begin()
        return ManualTransaction(tx)
