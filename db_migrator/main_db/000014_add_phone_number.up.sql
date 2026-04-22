-- =====================================================
-- Создание таблицы телефонных номеров
-- =====================================================

CREATE TABLE phone_number (
    id serial PRIMARY KEY,
    phone_pattern_id integer,
    number varchar(20),
    full_number varchar(30),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT fk_phone_number_pattern FOREIGN KEY (phone_pattern_id) REFERENCES phone_pattern(id)
);

CREATE UNIQUE INDEX phone_number_full_idx ON phone_number(full_number) WHERE deleted_at IS NULL AND full_number IS NOT NULL;
CREATE INDEX phone_number_pattern_id_idx ON phone_number(phone_pattern_id);

-- =====================================================
-- Функция для автоматической генерации full_number
-- =====================================================

CREATE OR REPLACE FUNCTION phone_number_generate_full()
RETURNS TRIGGER AS $$
DECLARE
    phone_code varchar(5);
BEGIN
    -- Генерируем full_number только если:
    -- 1. Он не заполнен (NULL или пустая строка)
    -- 2. Есть phone_pattern_id и number
    IF (NEW.full_number IS NULL OR NEW.full_number = '')
       AND NEW.phone_pattern_id IS NOT NULL 
       AND NEW.number IS NOT NULL 
       AND NEW.number != '' THEN
        
        SELECT country_phone_code INTO phone_code
        FROM phone_pattern 
        WHERE id = NEW.phone_pattern_id;
        
        IF phone_code IS NOT NULL THEN
            NEW.full_number := phone_code || NEW.number;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматической генерации full_number
CREATE TRIGGER trigger_phone_number_generate_full
    BEFORE INSERT OR UPDATE OF phone_pattern_id, number ON phone_number
    FOR EACH ROW
    EXECUTE FUNCTION phone_number_generate_full();

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER trigger_update_phone_number_updated_at 
    BEFORE UPDATE ON phone_number 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE phone_number IS 'Телефонные номера';
COMMENT ON COLUMN phone_number.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN phone_number.phone_pattern_id IS 'Ссылка на паттерн телефона (страна и правила)';
COMMENT ON COLUMN phone_number.number IS 'Номер телефона (без кода страны)';
COMMENT ON COLUMN phone_number.full_number IS 'Полный номер телефона с кодом страны (генерируется автоматически)';
COMMENT ON COLUMN phone_number.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN phone_number.updated_at IS 'Дата и время последнего обновления записи';
COMMENT ON COLUMN phone_number.deleted_at IS 'Дата и время удаления записи (soft delete)';
