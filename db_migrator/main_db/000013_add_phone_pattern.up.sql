-- =====================================================
-- Создание справочника телефонных паттернов
-- =====================================================

CREATE TABLE phone_pattern (
    id serial PRIMARY KEY,
    code varchar(50) NOT NULL,
    title varchar(200),
    country_id integer NOT NULL,
    country_phone_code varchar(5) NOT NULL,
    number_pattern varchar(50),
    min_length integer NOT NULL,
    max_length integer NOT NULL,
    mask varchar(50),
    example varchar(20),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT fk_phone_pattern_country FOREIGN KEY (country_id) REFERENCES country(id),
    CONSTRAINT chk_phone_pattern_code_format CHECK (((code)::text ~ '^[A-Z0-9_]{1,50}$'::text))
);

ALTER TABLE phone_pattern ADD CONSTRAINT phone_pattern_code_key UNIQUE (code);

CREATE UNIQUE INDEX phone_pattern_code_idx ON phone_pattern USING btree (code) WHERE (deleted_at IS NULL);
CREATE INDEX phone_pattern_country_id_idx ON phone_pattern(country_id);
CREATE INDEX phone_pattern_country_phone_code_idx ON phone_pattern(country_phone_code) WHERE (deleted_at IS NULL);

CREATE TRIGGER update_phone_pattern_updated_at 
    BEFORE UPDATE ON phone_pattern 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE phone_pattern IS 'Справочник телефонных паттернов для валидации номеров';
COMMENT ON COLUMN phone_pattern.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN phone_pattern.code IS 'Уникальный код паттерна';
COMMENT ON COLUMN phone_pattern.title IS 'Название паттерна';
COMMENT ON COLUMN phone_pattern.country_id IS 'Ссылка на страну';
COMMENT ON COLUMN phone_pattern.country_phone_code IS 'Телефонный код страны (+7, +1, +86...)';
COMMENT ON COLUMN phone_pattern.number_pattern IS 'Паттерн для валидации (регулярное выражение для первых цифр)';
COMMENT ON COLUMN phone_pattern.min_length IS 'Минимальная длина номера (без кода страны)';
COMMENT ON COLUMN phone_pattern.max_length IS 'Максимальная длина номера (без кода страны)';
COMMENT ON COLUMN phone_pattern.mask IS 'Маска для отображения в UI';
COMMENT ON COLUMN phone_pattern.example IS 'Пример номера';
COMMENT ON COLUMN phone_pattern.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN phone_pattern.updated_at IS 'Дата и время последнего обновления записи';
COMMENT ON COLUMN phone_pattern.deleted_at IS 'Дата и время удаления записи (soft delete)';

-- =====================================================
-- Начальные данные для основных стран
-- =====================================================

-- Россия (+7) - мобильные и города начинаются с 3, 4, 8, 9
INSERT INTO phone_pattern (code, country_id, country_phone_code, number_pattern, min_length, max_length, mask, example)
SELECT 'RU_PHONE_7', id, '+7', '^[3489]', 10, 10, '(999) 999-99-99', '9001234567'
FROM country WHERE code = 'RU';

-- Казахстан (+7) - мобильные и города начинаются с 6, 7
INSERT INTO phone_pattern (code, country_id, country_phone_code, number_pattern, min_length, max_length, mask, example)
SELECT 'KZ_PHONE_7', id, '+7', '^[67]', 10, 10, '(999) 999-99-99', '7001234567'
FROM country WHERE code = 'KZ';

-- США (+1)
INSERT INTO phone_pattern (code, country_id, country_phone_code, number_pattern, min_length, max_length, mask, example)
SELECT 'US_PHONE_1', id, '+1', NULL, 10, 10, '(999) 999-9999', '2025551234'
FROM country WHERE code = 'US';

-- Канада (+1)
INSERT INTO phone_pattern (code, country_id, country_phone_code, number_pattern, min_length, max_length, mask, example)
SELECT 'CA_PHONE_1', id, '+1', NULL, 10, 10, '(999) 999-9999', '4165551234'
FROM country WHERE code = 'CA';

-- Китай (+86)
INSERT INTO phone_pattern (code, country_id, country_phone_code, number_pattern, min_length, max_length, mask, example)
SELECT 'CN_PHONE_86', id, '+86', '^1', 11, 11, '999 9999 9999', '13812345678'
FROM country WHERE code = 'CN';

-- Германия (+49)
INSERT INTO phone_pattern (code, country_id, country_phone_code, number_pattern, min_length, max_length, mask, example)
SELECT 'DE_PHONE_49', id, '+49', NULL, 10, 11, '999 99999999', '15212345678'
FROM country WHERE code = 'DE';

-- Великобритания (+44)
INSERT INTO phone_pattern (code, country_id, country_phone_code, number_pattern, min_length, max_length, mask, example)
SELECT 'GB_PHONE_44', id, '+44', NULL, 10, 10, '9999 999999', '7400123456'
FROM country WHERE code = 'GB';

-- Франция (+33)
INSERT INTO phone_pattern (code, country_id, country_phone_code, number_pattern, min_length, max_length, mask, example)
SELECT 'FR_PHONE_33', id, '+33', NULL, 9, 9, '9 99 99 99 99', '612345678'
FROM country WHERE code = 'FR';

-- Япония (+81)
INSERT INTO phone_pattern (code, country_id, country_phone_code, number_pattern, min_length, max_length, mask, example)
SELECT 'JP_PHONE_81', id, '+81', NULL, 10, 10, '99-9999-9999', '9012345678'
FROM country WHERE code = 'JP';

-- Украина (+380)
INSERT INTO phone_pattern (code, country_id, country_phone_code, number_pattern, min_length, max_length, mask, example)
SELECT 'UA_PHONE_380', id, '+380', NULL, 9, 9, '(99) 999-99-99', '501234567'
FROM country WHERE code = 'UA';

-- Беларусь (+375)
INSERT INTO phone_pattern (code, country_id, country_phone_code, number_pattern, min_length, max_length, mask, example)
SELECT 'BY_PHONE_375', id, '+375', NULL, 9, 9, '(99) 999-99-99', '291234567'
FROM country WHERE code = 'BY';

-- Узбекистан (+998)
INSERT INTO phone_pattern (code, country_id, country_phone_code, number_pattern, min_length, max_length, mask, example)
SELECT 'UZ_PHONE_998', id, '+998', NULL, 9, 9, '99 999-99-99', '901234567'
FROM country WHERE code = 'UZ';

-- Индия (+91)
INSERT INTO phone_pattern (code, country_id, country_phone_code, number_pattern, min_length, max_length, mask, example)
SELECT 'IN_PHONE_91', id, '+91', NULL, 10, 10, '99999 99999', '9812345678'
FROM country WHERE code = 'IN';

-- Турция (+90)
INSERT INTO phone_pattern (code, country_id, country_phone_code, number_pattern, min_length, max_length, mask, example)
SELECT 'TR_PHONE_90', id, '+90', NULL, 10, 10, '(999) 999 99 99', '5321234567'
FROM country WHERE code = 'TR';

-- ОАЭ (+971)
INSERT INTO phone_pattern (code, country_id, country_phone_code, number_pattern, min_length, max_length, mask, example)
SELECT 'AE_PHONE_971', id, '+971', NULL, 9, 9, '99 999 9999', '501234567'
FROM country WHERE code = 'AE';

-- Израиль (+972)
INSERT INTO phone_pattern (code, country_id, country_phone_code, number_pattern, min_length, max_length, mask, example)
SELECT 'IL_PHONE_972', id, '+972', NULL, 9, 9, '99-999-9999', '501234567'
FROM country WHERE code = 'IL';
