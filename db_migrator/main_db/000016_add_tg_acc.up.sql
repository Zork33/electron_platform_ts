-- =====================================================
-- Создание таблицы Telegram аккаунтов
-- =====================================================

CREATE TABLE tg_acc (
    id serial PRIMARY KEY,
    user_id bigint,
    username varchar(50),
    first_name varchar(100),
    last_name varchar(100),
    phone_number_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT fk_tg_acc_phone_number FOREIGN KEY (phone_number_id) REFERENCES phone_number(id),
    CONSTRAINT chk_tg_acc_has_identifier CHECK (
        user_id IS NOT NULL OR 
        username IS NOT NULL OR 
        phone_number_id IS NOT NULL
    )
);

-- Уникальность user_id (основной идентификатор Telegram)
CREATE UNIQUE INDEX tg_acc_user_id_idx ON tg_acc(user_id) WHERE deleted_at IS NULL AND user_id IS NOT NULL;

-- Уникальность username (если указан)
CREATE UNIQUE INDEX tg_acc_username_idx ON tg_acc(username) WHERE deleted_at IS NULL AND username IS NOT NULL;

-- Индекс для FK
CREATE INDEX tg_acc_phone_number_id_idx ON tg_acc(phone_number_id);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER trigger_update_tg_acc_updated_at 
    BEFORE UPDATE ON tg_acc 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE tg_acc IS 'Telegram аккаунты';
COMMENT ON COLUMN tg_acc.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN tg_acc.user_id IS 'Числовой ID пользователя Telegram';
COMMENT ON COLUMN tg_acc.username IS 'Username Telegram (@username)';
COMMENT ON COLUMN tg_acc.first_name IS 'Имя из профиля Telegram';
COMMENT ON COLUMN tg_acc.last_name IS 'Фамилия из профиля Telegram';
COMMENT ON COLUMN tg_acc.phone_number_id IS 'Ссылка на телефонный номер (опционально)';
COMMENT ON COLUMN tg_acc.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN tg_acc.updated_at IS 'Дата и время последнего обновления записи';
COMMENT ON COLUMN tg_acc.deleted_at IS 'Дата и время удаления записи (soft delete)';
