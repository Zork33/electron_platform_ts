-- =====================================================
-- Откат настроек кодов подтверждения аутентификации
-- =====================================================

-- Удаляем триггер
DROP TRIGGER IF EXISTS trigger_user_auth_confirm_code_settings_updated_at ON user_auth_confirm_code_settings;

-- Удаляем внешние ключи
ALTER TABLE IF EXISTS user_auth_confirm_code_settings DROP CONSTRAINT IF EXISTS user_auth_confirm_code_settings_reason_id_fkey;

-- Удаляем таблицу
DROP TABLE IF EXISTS user_auth_confirm_code_settings;
