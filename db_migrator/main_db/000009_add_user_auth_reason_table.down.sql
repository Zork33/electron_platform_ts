-- =====================================================
-- Откат справочника причин аутентификации
-- =====================================================

-- Удаляем триггер
DROP TRIGGER IF EXISTS update_user_auth_reason_updated_at ON user_auth_reason;

-- Удаляем индексы
DROP INDEX IF EXISTS uq_user_auth_confirm_code_reason_title_alive;
DROP INDEX IF EXISTS user_auth_reason_code_idx;

-- Удаляем уникальные ограничения
ALTER TABLE IF EXISTS user_auth_reason DROP CONSTRAINT IF EXISTS user_auth_reason_code_key;

-- Удаляем таблицу
DROP TABLE IF EXISTS user_auth_reason;
