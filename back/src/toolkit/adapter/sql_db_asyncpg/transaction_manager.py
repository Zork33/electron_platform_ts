import sys
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from toolkit.adapter.abc.sql_db.connector import Connector
from toolkit.adapter.abc.sql_db.transaction_manager import (
    Transaction,
    TransactionManager as AbstractTransactionManager,
)


class ManualTransaction(Transaction):
    def __init__(self, conn, tx_context, pool):
        self._conn = conn
        self._tx_context = tx_context
        self._pool = pool
        self._completed = False

    @property
    def connection(self):
        return self._conn

    async def commit(self) -> None:
        if self._completed:
            raise RuntimeError("Транзакция уже завершена")
        
        try:
            await self._tx_context.__aexit__(None, None, None)
            self._completed = True
        finally:
            if self._conn:
                await self._pool.release(self._conn)

    async def rollback(self) -> None:
        if self._completed:
            raise RuntimeError("Транзакция уже завершена")
        
        try:
            exc_info = (Exception, Exception("Manual rollback"), None)
            await self._tx_context.__aexit__(*exc_info)
            self._completed = True
        finally:
            if self._conn:
                await self._pool.release(self._conn)


class TransactionManager(AbstractTransactionManager):
    def __init__(self, connector: Connector):
        if connector is None:
            raise ValueError("Connector не может быть None для TransactionManager")
        self._connector = connector

    @asynccontextmanager
    async def tx_context_manager(self) -> AsyncIterator:
        if self._connector.pool is None:
            raise RuntimeError("Пул соединений не инициализирован перед началом транзакции.")
        
        conn = None
        tx_context = None
        pool = self._connector.pool

        try:
            conn = await pool.acquire()
            tx_context = conn.transaction()
            await tx_context.__aenter__()
            yield conn
        except Exception:
            raise
        finally:
            if conn and tx_context:
                exc_info = sys.exc_info()
                await tx_context.__aexit__(*exc_info)
            if conn:
                await pool.release(conn)

    async def begin(self) -> ManualTransaction:
        if self._connector.pool is None:
            raise RuntimeError("Пул соединений не инициализирован перед началом транзакции.")
        
        pool = self._connector.pool
        conn = await pool.acquire()
        
        try:
            tx_context = conn.transaction()
            await tx_context.__aenter__()
            return ManualTransaction(conn, tx_context, pool)
        except Exception:
            await pool.release(conn)
            raise 