-- =====================================================
-- Создание таблицы кодов подтверждения аутентификации
-- =====================================================

-- Создаем таблицу кодов подтверждения
CREATE TABLE user_auth_confirm_code (
    id serial PRIMARY KEY,
    user_id integer,
    confirm_code varchar(50) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    auth_email varchar(100) NOT NULL,
    token uuid NOT NULL,
    first_name varchar(100),
    last_name varchar(100),
    middle_name varchar(100),
    reason_id integer,
    sending_at timestamp with time zone,
    is_sent boolean,
    sending_error text,
    sending_attempts_count integer DEFAULT 0 NOT NULL,
    verification_at timestamp with time zone,
    is_verified boolean,
    verification_error text,
    verification_attempts_count integer DEFAULT 0 NOT NULL,
    user_creation_at timestamp with time zone,
    is_user_created boolean,
    user_creation_error text,
    access_token_created_at timestamp with time zone,
    is_access_token_created boolean,
    access_token_error text,
    history jsonb
);

-- Добавляем уникальное ограничение на токен
ALTER TABLE user_auth_confirm_code ADD CONSTRAINT user_auth_confirm_code_session_token_key UNIQUE (token);

-- Добавляем внешние ключи
ALTER TABLE user_auth_confirm_code 
    ADD CONSTRAINT user_auth_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES "user"(id);

ALTER TABLE user_auth_confirm_code 
    ADD CONSTRAINT user_auth_confirm_code_reason_id_fkey 
    FOREIGN KEY (reason_id) REFERENCES user_auth_reason(id);

-- Создаем индекс для поиска по user_id (только живые записи)
CREATE INDEX user_auth_confirm_code_user_id_idx ON user_auth_confirm_code USING btree (user_id) WHERE (deleted_at IS NULL);

-- Создаем триггер для автоматического обновления updated_at
CREATE TRIGGER update_user_auth_updated_at 
    BEFORE UPDATE ON user_auth_confirm_code 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- КОММЕНТАРИИ
-- =====================================================

COMMENT ON TABLE user_auth_confirm_code IS 'Таблица для хранения данных аутентификации пользователей';
COMMENT ON COLUMN user_auth_confirm_code.id IS 'Уникальный идентификатор записи';
COMMENT ON COLUMN user_auth_confirm_code.user_id IS 'Идентификатор пользователя из таблицы user';
COMMENT ON COLUMN user_auth_confirm_code.confirm_code IS 'Код подтверждения';
COMMENT ON COLUMN user_auth_confirm_code.expires_at IS 'Время истечения срока действия кода';
COMMENT ON COLUMN user_auth_confirm_code.auth_email IS 'Email для отправки кода подтверждения';
COMMENT ON COLUMN user_auth_confirm_code.token IS 'Уникальный токен сессии';
COMMENT ON COLUMN user_auth_confirm_code.first_name IS 'Имя пользователя';
COMMENT ON COLUMN user_auth_confirm_code.last_name IS 'Фамилия пользователя';
COMMENT ON COLUMN user_auth_confirm_code.middle_name IS 'Отчество пользователя';
COMMENT ON COLUMN user_auth_confirm_code.reason_id IS 'Причина аутентификации';
COMMENT ON COLUMN user_auth_confirm_code.sending_at IS 'Время отправки кода';
COMMENT ON COLUMN user_auth_confirm_code.is_sent IS 'Флаг успешной отправки';
COMMENT ON COLUMN user_auth_confirm_code.sending_error IS 'Ошибка при отправке';
COMMENT ON COLUMN user_auth_confirm_code.sending_attempts_count IS 'Количество попыток отправки';
COMMENT ON COLUMN user_auth_confirm_code.verification_at IS 'Время проверки кода';
COMMENT ON COLUMN user_auth_confirm_code.is_verified IS 'Флаг успешной проверки';
COMMENT ON COLUMN user_auth_confirm_code.verification_error IS 'Ошибка при проверке';
COMMENT ON COLUMN user_auth_confirm_code.verification_attempts_count IS 'Количество попыток проверки';
COMMENT ON COLUMN user_auth_confirm_code.user_creation_at IS 'Время создания пользователя';
COMMENT ON COLUMN user_auth_confirm_code.is_user_created IS 'Флаг успешного создания пользователя';
COMMENT ON COLUMN user_auth_confirm_code.user_creation_error IS 'Ошибка при создании пользователя';
COMMENT ON COLUMN user_auth_confirm_code.access_token_created_at IS 'Время создания access token';
COMMENT ON COLUMN user_auth_confirm_code.is_access_token_created IS 'Флаг успешного создания access token';
COMMENT ON COLUMN user_auth_confirm_code.access_token_error IS 'Ошибка при создании access token';
COMMENT ON COLUMN user_auth_confirm_code.history IS 'История операций в формате JSON';
COMMENT ON COLUMN user_auth_confirm_code.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN user_auth_confirm_code.updated_at IS 'Дата и время последнего обновления записи';
COMMENT ON COLUMN user_auth_confirm_code.deleted_at IS 'Дата и время удаления записи (soft delete)';
