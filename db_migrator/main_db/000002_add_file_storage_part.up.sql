-- =====================================================
-- Создание справочника разделов файлового хранилища
-- =====================================================

CREATE TABLE file_storage_part (
    id serial PRIMARY KEY,
    title varchar(50) NOT NULL,
    code varchar(50) NOT NULL,
    name varchar(63) NOT NULL,
    is_public boolean NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT chk_file_storage_part_code_format CHECK (((code)::text ~ '^[A-Z0-9_]{1,50}$'::text)),
    CONSTRAINT chk_file_storage_part_name_format CHECK (((name)::text ~ '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$'::text))
);

ALTER TABLE file_storage_part ADD CONSTRAINT file_storage_part_code_key UNIQUE (code);
ALTER TABLE file_storage_part ADD CONSTRAINT file_storage_part_name_key UNIQUE (name);

CREATE UNIQUE INDEX file_storage_part_code_idx ON file_storage_part USING btree (code) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX file_storage_part_title_idx ON file_storage_part USING btree (title) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX file_storage_part_name_idx ON file_storage_part USING btree (name) WHERE (deleted_at IS NULL);

CREATE TRIGGER update_file_storage_part_updated_at 
    BEFORE UPDATE ON file_storage_part 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE file_storage_part IS 'Справочник разделов файлового хранилища (bucket в MinIO/S3, container в Azure)';
COMMENT ON COLUMN file_storage_part.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN file_storage_part.title IS 'Наименование';
COMMENT ON COLUMN file_storage_part.code IS 'Уникальный код';
COMMENT ON COLUMN file_storage_part.name IS 'Техническое имя раздела в хранилище (для MinIO/S3 соответствует правилам именования bucket)';
COMMENT ON COLUMN file_storage_part.is_public IS 'Публичный доступ к файлам раздела';
COMMENT ON COLUMN file_storage_part.description IS 'Описание назначения раздела';
COMMENT ON COLUMN file_storage_part.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN file_storage_part.updated_at IS 'Дата и время последнего обновления записи';
COMMENT ON COLUMN file_storage_part.deleted_at IS 'Дата и время удаления записи (soft delete)';

-- Начальные данные
INSERT INTO file_storage_part (title, code, name, is_public, description) VALUES 
    ('Публичные файлы', 'PUBLIC', 'public', true, 'Файлы с публичным доступом (фото объектов для сайта, превью)'),
    ('Приватные файлы', 'PRIVATE', 'private', false, 'Файлы с приватным доступом (документы, договоры, внутренние файлы)'),
    ('Корзина', 'TRASH', 'trash', false, 'Файлы, удалённые в корзину (soft delete)');
