-- =====================================================
-- Создание справочника пола
-- =====================================================

CREATE TABLE gender (
    id serial PRIMARY KEY,
    title varchar(50) NOT NULL,
    code varchar(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT chk_gender_code_format CHECK (((code)::text ~ '^[A-Z0-9_]{1,50}$'::text))
);

ALTER TABLE gender ADD CONSTRAINT gender_code_key UNIQUE (code);

CREATE UNIQUE INDEX gender_code_idx ON gender USING btree (code) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX gender_title_idx ON gender USING btree (title) WHERE (deleted_at IS NULL);

CREATE TRIGGER update_gender_updated_at 
    BEFORE UPDATE ON gender 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE gender IS 'Справочник пол';
COMMENT ON COLUMN gender.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN gender.title IS 'Наименование';
COMMENT ON COLUMN gender.code IS 'Уникальный код';
COMMENT ON COLUMN gender.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN gender.updated_at IS 'Дата и время последнего обновления записи';
COMMENT ON COLUMN gender.deleted_at IS 'Дата и время удаления записи (soft delete)';

-- Начальные данные
INSERT INTO gender (title, code) VALUES 
    ('Мужской', 'MALE'),
    ('Женский', 'FEMALE');
