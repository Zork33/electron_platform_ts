-- =====================================================
-- Создание справочника причин аутентификации
-- =====================================================

-- Создаем таблицу справочника причин аутентификации
CREATE TABLE user_auth_reason (
    id serial PRIMARY KEY,
    title varchar(150) NOT NULL,
    code varchar(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT chk_user_auth_reason_code_format CHECK (((code)::text ~ '^[A-Z0-9_]{1,50}$'::text))
);

-- Добавляем уникальное ограничение на код
ALTER TABLE user_auth_reason ADD CONSTRAINT user_auth_reason_code_key UNIQUE (code);

-- Создаем уникальные индексы для живых записей
CREATE UNIQUE INDEX user_auth_reason_code_idx ON user_auth_reason USING btree (code) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX uq_user_auth_confirm_code_reason_title_alive ON user_auth_reason USING btree (title) WHERE (deleted_at IS NULL);

-- Создаем триггер для автоматического обновления updated_at
CREATE TRIGGER update_user_auth_reason_updated_at 
    BEFORE UPDATE ON user_auth_reason 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- КОММЕНТАРИИ
-- =====================================================

COMMENT ON TABLE user_auth_reason IS 'Справочник причин аутентификации пользователей';
COMMENT ON COLUMN user_auth_reason.id IS 'Уникальный идентификатор записи';
COMMENT ON COLUMN user_auth_reason.title IS 'Наименование причины аутентификации';
COMMENT ON COLUMN user_auth_reason.code IS 'Уникальный код причины аутентификации';
COMMENT ON COLUMN user_auth_reason.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN user_auth_reason.updated_at IS 'Дата и время последнего обновления записи';
COMMENT ON COLUMN user_auth_reason.deleted_at IS 'Дата и время удаления записи (soft delete)';

-- =====================================================
-- НАЧАЛЬНЫЕ ДАННЫЕ
-- =====================================================

-- Добавляем базовые причины аутентификации
INSERT INTO user_auth_reason (title, code) VALUES 
    ('Регистрация пользователя', 'REGISTRATION'),
    ('Подтверждение входа', 'LOGIN');
