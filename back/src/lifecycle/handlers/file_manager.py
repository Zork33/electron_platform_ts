from toolkit.tool.file_manager.tool import FileManager
from toolkit.tool.file_manager.config import FileManagerConfig
from toolkit.tool.file_storage.tool import FileStorage
from toolkit.tool.sql_db.tool import SqlDb


def create_file_manager() -> FileManager:
    file_storage: FileStorage = FileStorage.get_from_container("file_storage")
    db_client: SqlDb = SqlDb.get_from_container("db")

    file_manager = FileManager(
        "file_manager",
        file_storage=file_storage,
        db_client=db_client,
        config=FileManagerConfig(),
    )

    print("FileManager initialized successfully")

    return file_manager
