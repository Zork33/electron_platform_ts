-- =====================================================
-- Создание таблицы коллекций файлов
-- =====================================================

CREATE TABLE file_collection (
    id          serial PRIMARY KEY,
    title       varchar(255),
    description text,

    created_at  timestamp with time zone DEFAULT now(),
    updated_at  timestamp with time zone DEFAULT now(),
    deleted_at  timestamp with time zone
);

CREATE INDEX file_collection_deleted_at_idx
    ON file_collection(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_update_file_collection_updated_at
    BEFORE UPDATE ON file_collection
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE file_collection IS 'Коллекции файлов (галереи, наборы медиа и т.д.)';
COMMENT ON COLUMN file_collection.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN file_collection.title IS 'Название коллекции (опционально)';
COMMENT ON COLUMN file_collection.description IS 'Описание коллекции (опционально)';
COMMENT ON COLUMN file_collection.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN file_collection.updated_at IS 'Дата и время последнего обновления записи';
COMMENT ON COLUMN file_collection.deleted_at IS 'Дата и время удаления записи (soft delete)';
