import asyncio
from datetime import datetime, timedelta
from .models import ObjectKey, CleanupLogEntry
from .storage import Storage


class Cleaner:
    def __init__(self, storage: Storage):
        self._storage = storage
        self._cleanup_task: asyncio.Task | None = None
        self._is_running = False
        self._interval_seconds = None
        self._last_cleanup_time: datetime | None = None
        self._cleanup_log: list[CleanupLogEntry] = []
        self._max_log_entries = 100
    
    @property
    def is_running(self) -> bool:
        return self._is_running
    
    @property
    def interval_seconds(self) -> int:
        return self._interval_seconds
    
    @property
    def last_cleanup_time(self) -> datetime | None:
        return self._last_cleanup_time
    
    @property
    def next_cleanup_time(self) -> datetime | None:
        if not self._is_running or not self._last_cleanup_time:
            return None
        return self._last_cleanup_time + timedelta(seconds=self._interval_seconds) 
    
    @property
    def cleanup_log(self) -> list[CleanupLogEntry]:
        return self._cleanup_log

    async def start(self, interval_seconds: int = 300):
        if self._is_running:
            return
            
        self._interval_seconds = interval_seconds
        self._is_running = True
        self._cleanup_task = asyncio.create_task(self._cleanup_loop(interval_seconds))

    async def _cleanup_loop(self, interval_seconds: int):
        while self._is_running:
            try:
                await asyncio.sleep(interval_seconds)
                self.cleanup_expired_objects()
            except asyncio.CancelledError:
                break

    def cleanup_expired_objects(self) -> int:
        storage = self._storage.get_storage()
        expired_keys = []
        
        for category, objects in storage.items():
            for id, entry in objects.items():
                if entry.metadata.is_expired():
                    expired_keys.append(ObjectKey(category, id))
        
        cleaned_count = 0
        for key in expired_keys:
            if self._storage.remove(key):
                cleaned_count += 1

        cleanup_time = datetime.now()
        self._last_cleanup_time = cleanup_time
        self._cleanup_log.append(CleanupLogEntry(cleanup_time, cleaned_count))
        
        if len(self._cleanup_log) > self._max_log_entries:
            self._cleanup_log = self._cleanup_log[-self._max_log_entries:]
        
        return cleaned_count
    
    async def stop(self):
        self._is_running = False
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
