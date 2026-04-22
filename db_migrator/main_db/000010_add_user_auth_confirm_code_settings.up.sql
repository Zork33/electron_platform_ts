-- =====================================================
-- Создание настроек кодов подтверждения аутентификации
-- =====================================================

-- Создаем таблицу настроек кодов подтверждения
CREATE TABLE user_auth_confirm_code_settings (
    id serial PRIMARY KEY,
    reason_id integer NOT NULL,
    confirm_code_length integer DEFAULT 6 NOT NULL,
    confirm_code_ttl_minutes integer DEFAULT 5 NOT NULL,
    confirm_code_alphabet varchar(50) DEFAULT '0123456789' NOT NULL,
    sending_max_attempts_count integer DEFAULT 3 NOT NULL,
    sending_cooldown_seconds integer DEFAULT 60 NOT NULL,
    verification_max_attempts_count integer DEFAULT 3 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    sending_subject varchar(150) NOT NULL
);

-- Добавляем внешний ключ на справочник причин
ALTER TABLE user_auth_confirm_code_settings 
    ADD CONSTRAINT user_auth_confirm_code_settings_reason_id_fkey 
    FOREIGN KEY (reason_id) REFERENCES user_auth_reason(id);

-- Создаем триггер для автоматического обновления updated_at
CREATE TRIGGER trigger_user_auth_confirm_code_settings_updated_at 
    BEFORE UPDATE ON user_auth_confirm_code_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- КОММЕНТАРИИ
-- =====================================================

COMMENT ON TABLE user_auth_confirm_code_settings IS 'Настройки кодов подтверждения аутентификации';
COMMENT ON COLUMN user_auth_confirm_code_settings.id IS 'Уникальный идентификатор записи';
COMMENT ON COLUMN user_auth_confirm_code_settings.reason_id IS 'Ссылка на причину аутентификации';
COMMENT ON COLUMN user_auth_confirm_code_settings.confirm_code_length IS 'Длина кода подтверждения';
COMMENT ON COLUMN user_auth_confirm_code_settings.confirm_code_ttl_minutes IS 'Время жизни кода в минутах';
COMMENT ON COLUMN user_auth_confirm_code_settings.confirm_code_alphabet IS 'Алфавит для генерации кода';
COMMENT ON COLUMN user_auth_confirm_code_settings.sending_max_attempts_count IS 'Максимальное количество попыток отправки';
COMMENT ON COLUMN user_auth_confirm_code_settings.sending_cooldown_seconds IS 'Время ожидания между отправками в секундах';
COMMENT ON COLUMN user_auth_confirm_code_settings.verification_max_attempts_count IS 'Максимальное количество попыток проверки';
COMMENT ON COLUMN user_auth_confirm_code_settings.sending_subject IS 'Тема письма для отправки кода';
COMMENT ON COLUMN user_auth_confirm_code_settings.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN user_auth_confirm_code_settings.updated_at IS 'Дата и время последнего обновления записи';
COMMENT ON COLUMN user_auth_confirm_code_settings.deleted_at IS 'Дата и время удаления записи (soft delete)';

-- =====================================================
-- НАЧАЛЬНЫЕ ДАННЫЕ
-- =====================================================

-- Добавляем настройки для всех причин аутентификации
INSERT INTO user_auth_confirm_code_settings 
    (reason_id, confirm_code_length, confirm_code_ttl_minutes, confirm_code_alphabet, 
     sending_max_attempts_count, sending_cooldown_seconds, verification_max_attempts_count, sending_subject)
VALUES 
    -- Регистрация пользователя
    ((SELECT id FROM user_auth_reason WHERE code = 'REGISTRATION'), 
     6, 10, '0123456789', 3, 60, 5, 'Код подтверждения регистрации'),
    
    -- Подтверждение входа
    ((SELECT id FROM user_auth_reason WHERE code = 'LOGIN'), 
     6, 5, '0123456789', 3, 30, 5, 'Код подтверждения входа');
