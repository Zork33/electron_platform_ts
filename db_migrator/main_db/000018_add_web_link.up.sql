-- =====================================================
-- Создание таблицы веб-ссылок
-- =====================================================

CREATE TABLE web_link (
    id serial PRIMARY KEY,
    title varchar(200),
    type_id integer NOT NULL,
    custom_type_name varchar(100),
    url varchar(2000) NOT NULL,
    description varchar(500),
    
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    
    CONSTRAINT fk_web_link_type
        FOREIGN KEY (type_id)
        REFERENCES web_link_type(id)
);

CREATE INDEX web_link_type_id_idx ON web_link(type_id);
CREATE INDEX web_link_url_idx ON web_link(url);

CREATE TRIGGER trigger_update_web_link_updated_at
    BEFORE UPDATE ON web_link
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE web_link IS 'Веб-ссылки (сайты, соцсети, блоги и т.д.)';
COMMENT ON COLUMN web_link.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN web_link.title IS 'Наименование (например "Мой блог", "Рабочий GitHub")';
COMMENT ON COLUMN web_link.type_id IS 'Тип ссылки из справочника';
COMMENT ON COLUMN web_link.custom_type_name IS 'Наименование типа при type_id = OTHER';
COMMENT ON COLUMN web_link.url IS 'URL ссылки';
COMMENT ON COLUMN web_link.description IS 'Дополнительное описание';
