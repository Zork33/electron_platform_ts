-- =====================================================
-- Создание таблицы контактной информации
-- =====================================================

CREATE TABLE contact_info (
    id serial PRIMARY KEY,
    
    -- Владелец контакта (кому принадлежит)
    person_id integer,
    
    -- Каналы коммуникации (ровно один должен быть заполнен)
    phone_number_id integer,
    tg_acc_id integer,
    email_id integer,
    web_link_id integer,
    
    -- Описание контакта
    description varchar(100),
    is_primary boolean DEFAULT false,
    
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    
    -- FK на владельца
    CONSTRAINT fk_contact_info_person 
        FOREIGN KEY (person_id) 
        REFERENCES person(id),
    
    -- FK на каналы
    CONSTRAINT fk_contact_info_phone_number 
        FOREIGN KEY (phone_number_id) 
        REFERENCES phone_number(id),
    CONSTRAINT fk_contact_info_tg_acc 
        FOREIGN KEY (tg_acc_id) 
        REFERENCES tg_acc(id),
    CONSTRAINT fk_contact_info_email 
        FOREIGN KEY (email_id) 
        REFERENCES email(id),
    CONSTRAINT fk_contact_info_web_link
        FOREIGN KEY (web_link_id)
        REFERENCES web_link(id),
    
    -- Должен быть указан ровно один канал
    CONSTRAINT chk_contact_info_one_channel CHECK (
        (phone_number_id IS NOT NULL)::int +
        (tg_acc_id IS NOT NULL)::int +
        (email_id IS NOT NULL)::int +
        (web_link_id IS NOT NULL)::int = 1
    )
);

-- Индексы для FK
CREATE INDEX contact_info_person_id_idx ON contact_info(person_id);
CREATE INDEX contact_info_phone_number_id_idx ON contact_info(phone_number_id);
CREATE INDEX contact_info_tg_acc_id_idx ON contact_info(tg_acc_id);
CREATE INDEX contact_info_email_id_idx ON contact_info(email_id);
CREATE INDEX contact_info_web_link_id_idx ON contact_info(web_link_id);

-- Индекс для поиска основного контакта
CREATE INDEX contact_info_is_primary_idx ON contact_info(is_primary) WHERE is_primary = true AND deleted_at IS NULL;

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER trigger_update_contact_info_updated_at 
    BEFORE UPDATE ON contact_info 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE contact_info IS 'Контактная информация (связь персоны/компании с каналами коммуникации)';
COMMENT ON COLUMN contact_info.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN contact_info.person_id IS 'Ссылка на персону (владелец контакта)';
COMMENT ON COLUMN contact_info.phone_number_id IS 'Ссылка на телефонный номер';
COMMENT ON COLUMN contact_info.tg_acc_id IS 'Ссылка на Telegram аккаунт';
COMMENT ON COLUMN contact_info.email_id IS 'Ссылка на email адрес';
COMMENT ON COLUMN contact_info.web_link_id IS 'Ссылка на веб-ссылку';
COMMENT ON COLUMN contact_info.description IS 'Описание контакта (например: "Личный", "Рабочий", "Домашний")';
COMMENT ON COLUMN contact_info.is_primary IS 'Основной контакт';
COMMENT ON COLUMN contact_info.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN contact_info.updated_at IS 'Дата и время последнего обновления записи';
COMMENT ON COLUMN contact_info.deleted_at IS 'Дата и время удаления записи (soft delete)';
