-- =====================================================
-- Создание таблицы person (физические лица)
-- =====================================================

CREATE TABLE person (
    id serial PRIMARY KEY,
    last_name varchar(100),
    first_name varchar(100) NOT NULL,
    middle_name varchar(100),
    birth_date date,
    gender_id integer,
    description text,
    vector_db_record_id integer,
    is_vector_synced boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT fk_person_gender FOREIGN KEY (gender_id) REFERENCES gender(id)
);

CREATE TRIGGER trigger_update_person_updated_at 
    BEFORE UPDATE ON person 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX person_gender_id_idx ON person(gender_id);

COMMENT ON TABLE person IS 'Человек';
COMMENT ON COLUMN person.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN person.last_name IS 'Фамилия';
COMMENT ON COLUMN person.first_name IS 'Имя';
COMMENT ON COLUMN person.middle_name IS 'Отчество';
COMMENT ON COLUMN person.birth_date IS 'Дата рождения';
COMMENT ON COLUMN person.gender_id IS 'Ссылка на справочник пола';
COMMENT ON COLUMN person.description IS 'Текстовое описание (используется для векторизации)';
COMMENT ON COLUMN person.vector_db_record_id IS 'ID записи в векторной БД';
COMMENT ON COLUMN person.is_vector_synced IS 'Флаг синхронизации с векторной БД';
COMMENT ON COLUMN person.created_at IS 'Время создания записи';
COMMENT ON COLUMN person.updated_at IS 'Время последнего обновления записи';
COMMENT ON COLUMN person.deleted_at IS 'Дата и время удаления записи (soft delete)';
