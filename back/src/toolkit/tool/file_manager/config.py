from toolkit.abc.config import Config


class FileManagerConfig(Config):
    metadata_table: str = "stored_file"
