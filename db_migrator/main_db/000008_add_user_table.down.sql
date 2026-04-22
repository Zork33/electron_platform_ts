-- =====================================================
-- Откат создания таблицы user
-- =====================================================

-- Удаляем триггер
DROP TRIGGER IF EXISTS update_user_updated_at ON "user";

-- Удаляем индексы
DROP INDEX IF EXISTS user_avatar_id_idx;
DROP INDEX IF EXISTS user_auth_email_idx;

-- Удаляем внешние ключи
ALTER TABLE IF EXISTS "user" DROP CONSTRAINT IF EXISTS user_avatar_id_fkey;
ALTER TABLE IF EXISTS "user" DROP CONSTRAINT IF EXISTS user_person_id_fkey;

-- Удаляем уникальные ограничения
ALTER TABLE IF EXISTS "user" DROP CONSTRAINT IF EXISTS user_person_id_key;

-- Удаляем таблицу
DROP TABLE IF EXISTS "user";
