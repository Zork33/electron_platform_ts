-- =====================================================
-- Создание таблицы элементов коллекции файлов
-- =====================================================

CREATE TABLE file_collection_item (
    id                  serial PRIMARY KEY,
    file_collection_id  integer NOT NULL,
    stored_file_id      integer NOT NULL,
    sort_order          integer DEFAULT 0,

    created_at          timestamp with time zone DEFAULT now(),
    updated_at          timestamp with time zone DEFAULT now(),
    deleted_at          timestamp with time zone,

    CONSTRAINT fk_file_collection_item_collection
        FOREIGN KEY (file_collection_id)
        REFERENCES file_collection(id),

    CONSTRAINT fk_file_collection_item_stored_file
        FOREIGN KEY (stored_file_id)
        REFERENCES stored_file(id)
);

CREATE INDEX file_collection_item_collection_id_idx
    ON file_collection_item(file_collection_id);
CREATE INDEX file_collection_item_stored_file_id_idx
    ON file_collection_item(stored_file_id);
CREATE INDEX file_collection_item_deleted_at_idx
    ON file_collection_item(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_update_file_collection_item_updated_at
    BEFORE UPDATE ON file_collection_item
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE file_collection_item IS 'Файлы, входящие в коллекцию';
COMMENT ON COLUMN file_collection_item.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN file_collection_item.file_collection_id IS 'Ссылка на коллекцию';
COMMENT ON COLUMN file_collection_item.stored_file_id IS 'Ссылка на файл в хранилище';
COMMENT ON COLUMN file_collection_item.sort_order IS 'Порядок отображения в коллекции';
COMMENT ON COLUMN file_collection_item.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN file_collection_item.updated_at IS 'Дата и время последнего обновления записи';
COMMENT ON COLUMN file_collection_item.deleted_at IS 'Дата и время удаления записи (soft delete)';
