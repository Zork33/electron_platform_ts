-- =====================================================
-- Создание таблицы email адресов
-- =====================================================

CREATE TABLE email (
    id serial PRIMARY KEY,
    address varchar(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);

-- Уникальность email адреса
CREATE UNIQUE INDEX email_address_idx ON email(address) WHERE deleted_at IS NULL;

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER trigger_update_email_updated_at 
    BEFORE UPDATE ON email 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE email IS 'Email адреса';
COMMENT ON COLUMN email.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN email.address IS 'Email адрес';
COMMENT ON COLUMN email.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN email.updated_at IS 'Дата и время последнего обновления записи';
COMMENT ON COLUMN email.deleted_at IS 'Дата и время удаления записи (soft delete)';
