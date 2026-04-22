-- =====================================================
-- Создание справочника стран
-- =====================================================

CREATE TABLE country (
    id serial PRIMARY KEY,
    code varchar(2) NOT NULL,
    title varchar(200),
    name_ru varchar(100) NOT NULL,
    name_en varchar(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT chk_country_code_format CHECK (((code)::text ~ '^[A-Z]{2}$'::text))
);

ALTER TABLE country ADD CONSTRAINT country_code_key UNIQUE (code);

CREATE UNIQUE INDEX country_code_idx ON country USING btree (code) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX country_title_idx ON country USING btree (title) WHERE (deleted_at IS NULL);

-- =====================================================
-- Функция для генерации title
-- =====================================================

CREATE OR REPLACE FUNCTION country_generate_title()
RETURNS TRIGGER AS $$
BEGIN
    -- Формируем title как "Россия, Russia (RU)"
    NEW.title := NEW.name_ru || ', ' || NEW.name_en || ' (' || NEW.code || ')';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматической генерации title
CREATE TRIGGER trigger_country_generate_title
    BEFORE INSERT OR UPDATE OF name_ru, name_en, code ON country
    FOR EACH ROW
    EXECUTE FUNCTION country_generate_title();

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_country_updated_at 
    BEFORE UPDATE ON country 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE country IS 'Справочник стран (ISO 3166-1 alpha-2)';
COMMENT ON COLUMN country.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN country.code IS 'ISO код страны (2 символа)';
COMMENT ON COLUMN country.title IS 'Полное название (генерируется автоматически)';
COMMENT ON COLUMN country.name_ru IS 'Название страны на русском';
COMMENT ON COLUMN country.name_en IS 'Название страны на английском';
COMMENT ON COLUMN country.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN country.updated_at IS 'Дата и время последнего обновления записи';
COMMENT ON COLUMN country.deleted_at IS 'Дата и время удаления записи (soft delete)';

-- =====================================================
-- Начальные данные (топ-60 стран)
-- =====================================================

INSERT INTO country (code, name_ru, name_en) VALUES
    ('RU', 'Россия', 'Russia'),
    ('US', 'США', 'United States'),
    ('CN', 'Китай', 'China'),
    ('IN', 'Индия', 'India'),
    ('BR', 'Бразилия', 'Brazil'),
    ('ID', 'Индонезия', 'Indonesia'),
    ('PK', 'Пакистан', 'Pakistan'),
    ('NG', 'Нигерия', 'Nigeria'),
    ('BD', 'Бангладеш', 'Bangladesh'),
    ('MX', 'Мексика', 'Mexico'),
    ('JP', 'Япония', 'Japan'),
    ('ET', 'Эфиопия', 'Ethiopia'),
    ('PH', 'Филиппины', 'Philippines'),
    ('EG', 'Египет', 'Egypt'),
    ('VN', 'Вьетнам', 'Vietnam'),
    ('CD', 'Конго (ДР)', 'Congo (DRC)'),
    ('TR', 'Турция', 'Turkey'),
    ('IR', 'Иран', 'Iran'),
    ('DE', 'Германия', 'Germany'),
    ('TH', 'Таиланд', 'Thailand'),
    ('GB', 'Великобритания', 'United Kingdom'),
    ('FR', 'Франция', 'France'),
    ('IT', 'Италия', 'Italy'),
    ('ZA', 'ЮАР', 'South Africa'),
    ('TZ', 'Танзания', 'Tanzania'),
    ('MM', 'Мьянма', 'Myanmar'),
    ('KE', 'Кения', 'Kenya'),
    ('KR', 'Южная Корея', 'South Korea'),
    ('CO', 'Колумбия', 'Colombia'),
    ('ES', 'Испания', 'Spain'),
    ('AR', 'Аргентина', 'Argentina'),
    ('DZ', 'Алжир', 'Algeria'),
    ('SD', 'Судан', 'Sudan'),
    ('UA', 'Украина', 'Ukraine'),
    ('UG', 'Уганда', 'Uganda'),
    ('IQ', 'Ирак', 'Iraq'),
    ('CA', 'Канада', 'Canada'),
    ('PL', 'Польша', 'Poland'),
    ('MA', 'Марокко', 'Morocco'),
    ('SA', 'Саудовская Аравия', 'Saudi Arabia'),
    ('UZ', 'Узбекистан', 'Uzbekistan'),
    ('PE', 'Перу', 'Peru'),
    ('MY', 'Малайзия', 'Malaysia'),
    ('AF', 'Афганистан', 'Afghanistan'),
    ('MZ', 'Мозамбик', 'Mozambique'),
    ('GH', 'Гана', 'Ghana'),
    ('YE', 'Йемен', 'Yemen'),
    ('NP', 'Непал', 'Nepal'),
    ('VE', 'Венесуэла', 'Venezuela'),
    ('AU', 'Австралия', 'Australia'),
    ('KZ', 'Казахстан', 'Kazakhstan'),
    ('BY', 'Беларусь', 'Belarus'),
    ('AE', 'ОАЭ', 'United Arab Emirates'),
    ('IL', 'Израиль', 'Israel'),
    ('CZ', 'Чехия', 'Czech Republic'),
    ('AT', 'Австрия', 'Austria'),
    ('CH', 'Швейцария', 'Switzerland'),
    ('SE', 'Швеция', 'Sweden'),
    ('NO', 'Норвегия', 'Norway'),
    ('FI', 'Финляндия', 'Finland');
