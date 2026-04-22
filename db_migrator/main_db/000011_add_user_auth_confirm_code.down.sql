-- =====================================================
-- Откат таблицы кодов подтверждения аутентификации
-- =====================================================

-- Удаляем триггер
DROP TRIGGER IF EXISTS update_user_auth_updated_at ON user_auth_confirm_code;

-- Удаляем индексы
DROP INDEX IF EXISTS user_auth_confirm_code_user_id_idx;

-- Удаляем внешние ключи
ALTER TABLE IF EXISTS user_auth_confirm_code DROP CONSTRAINT IF EXISTS user_auth_confirm_code_reason_id_fkey;
ALTER TABLE IF EXISTS user_auth_confirm_code DROP CONSTRAINT IF EXISTS user_auth_user_id_fkey;

-- Удаляем уникальные ограничения
ALTER TABLE IF EXISTS user_auth_confirm_code DROP CONSTRAINT IF EXISTS user_auth_confirm_code_session_token_key;

-- Удаляем таблицу
DROP TABLE IF EXISTS user_auth_confirm_code;
