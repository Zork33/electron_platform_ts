-- =====================================================
-- Создание таблицы хранимых файлов
-- =====================================================

CREATE TABLE stored_file (
    id serial PRIMARY KEY,
    
    -- Связь с разделом файлового хранилища
    file_storage_part_id integer NOT NULL,
    
    -- Путь к файлу внутри раздела
    path varchar(1024) NOT NULL,
    
    -- Метаданные файла
    filename varchar(255) NOT NULL,
    ext varchar(10) NOT NULL,
    size_bytes bigint NOT NULL,
    
    -- Системные поля
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    
    -- Foreign keys
    CONSTRAINT fk_stored_file_file_storage_part 
        FOREIGN KEY (file_storage_part_id) 
        REFERENCES file_storage_part(id),
    
    -- Уникальность в хранилище
    CONSTRAINT uq_stored_file_part_path 
        UNIQUE (file_storage_part_id, path)
);

-- Индексы
CREATE INDEX stored_file_file_storage_part_id_idx ON stored_file(file_storage_part_id);
CREATE INDEX stored_file_deleted_at_idx ON stored_file(deleted_at) WHERE deleted_at IS NULL;

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER trigger_update_stored_file_updated_at 
    BEFORE UPDATE ON stored_file 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE stored_file IS 'Метаданные файлов, хранящихся в файловом хранилище';
COMMENT ON COLUMN stored_file.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN stored_file.file_storage_part_id IS 'Ссылка на раздел файлового хранилища';
COMMENT ON COLUMN stored_file.path IS 'Путь к файлу внутри раздела';
COMMENT ON COLUMN stored_file.filename IS 'Имя файла при загрузке';
COMMENT ON COLUMN stored_file.ext IS 'Расширение файла';
COMMENT ON COLUMN stored_file.size_bytes IS 'Размер файла в байтах';
COMMENT ON COLUMN stored_file.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN stored_file.updated_at IS 'Дата и время последнего обновления записи';
COMMENT ON COLUMN stored_file.deleted_at IS 'Дата и время удаления записи (soft delete)';
