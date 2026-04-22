-- =====================================================
-- Создание таблицы user (пользователи системы)
-- =====================================================

-- Создаем таблицу user
CREATE TABLE "user" (
    id serial PRIMARY KEY,
    person_id integer,
    auth_email varchar(255),
    has_access boolean DEFAULT true,
    auth_session_expires_at timestamp with time zone,
    is_admin boolean DEFAULT false,
    avatar_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);

-- Добавляем уникальные ограничения
ALTER TABLE "user" ADD CONSTRAINT user_person_id_key UNIQUE (person_id);

-- Добавляем внешние ключи
ALTER TABLE "user" ADD CONSTRAINT user_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id);
ALTER TABLE "user" ADD CONSTRAINT user_avatar_id_fkey FOREIGN KEY (avatar_id) REFERENCES stored_file(id);

-- Индекс для avatar_id (частичный, только для непустых)
CREATE INDEX user_avatar_id_idx ON "user"(avatar_id) WHERE avatar_id IS NOT NULL;

-- Создаем уникальный индекс для email (только для живых записей с email)
CREATE UNIQUE INDEX user_auth_email_idx ON "user" USING btree (auth_email) WHERE ((deleted_at IS NULL) AND (auth_email IS NOT NULL));

-- Создаем триггер для автоматического обновления updated_at
CREATE TRIGGER update_user_updated_at 
    BEFORE UPDATE ON "user" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- КОММЕНТАРИИ
-- =====================================================

COMMENT ON TABLE "user" IS 'Таблица пользователей системы (аккаунты)';
COMMENT ON COLUMN "user".id IS 'Уникальный идентификатор записи';
COMMENT ON COLUMN "user".person_id IS 'Связь с записью в таблице person';
COMMENT ON COLUMN "user".auth_email IS 'Email для аутентификации';
COMMENT ON COLUMN "user".has_access IS 'Флаг доступа пользователя к системе';
COMMENT ON COLUMN "user".auth_session_expires_at IS 'Время истечения авторизованной сессии пользователя';
COMMENT ON COLUMN "user".is_admin IS 'Флаг администратора системы';
COMMENT ON COLUMN "user".avatar_id IS 'Ссылка на файл аватарки пользователя (stored_file)';
COMMENT ON COLUMN "user".deleted_at IS 'Дата и время удаления записи (soft delete)';
COMMENT ON COLUMN "user".created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN "user".updated_at IS 'Дата и время последнего обновления записи';