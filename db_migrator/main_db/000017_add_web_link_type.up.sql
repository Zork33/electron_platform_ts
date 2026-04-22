-- =====================================================
-- Создание справочника типов веб-ссылок
-- =====================================================

CREATE TABLE web_link_type (
    id serial PRIMARY KEY,
    title varchar(100) NOT NULL,
    code varchar(50) NOT NULL,
    icon varchar(50),
    icon_color varchar(20),
    image_id integer,
    base_url varchar(500),
    sort_index integer NOT NULL DEFAULT 0,
    description varchar(500),
    
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    
    CONSTRAINT fk_web_link_type_stored_file
        FOREIGN KEY (image_id)
        REFERENCES stored_file(id),
    CONSTRAINT chk_web_link_type_code_format
        CHECK (code ~ '^[A-Z0-9_]{1,50}$')
);

CREATE UNIQUE INDEX web_link_type_code_idx ON web_link_type(code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX web_link_type_title_idx ON web_link_type(title) WHERE deleted_at IS NULL;
CREATE INDEX web_link_type_sort_index_idx ON web_link_type(sort_index);
CREATE INDEX web_link_type_image_id_idx ON web_link_type(image_id) WHERE image_id IS NOT NULL;

CREATE TRIGGER trigger_update_web_link_type_updated_at
    BEFORE UPDATE ON web_link_type
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE web_link_type IS 'Справочник типов веб-ссылок (сайт, соцсети, блог и т.д.)';
COMMENT ON COLUMN web_link_type.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN web_link_type.title IS 'Наименование типа';
COMMENT ON COLUMN web_link_type.code IS 'Уникальный код';
COMMENT ON COLUMN web_link_type.icon IS 'Код иконки из иконочной библиотеки (например mdi-vk)';
COMMENT ON COLUMN web_link_type.icon_color IS 'Цвет иконки (например #0077FF)';
COMMENT ON COLUMN web_link_type.image_id IS 'Кастомная иконка (файл в MinIO), приоритет над icon';
COMMENT ON COLUMN web_link_type.base_url IS 'Базовый URL для формирования ссылки (например https://vk.com/)';
COMMENT ON COLUMN web_link_type.sort_index IS 'Порядковый номер для сортировки';
COMMENT ON COLUMN web_link_type.description IS 'Описание типа';

INSERT INTO web_link_type (code, title, icon, icon_color, base_url, sort_index, description) VALUES
    ('WEBSITE', 'Сайт', 'mdi-web', NULL, 'https://', 1, 'Официальный сайт'),
    ('VK', 'ВКонтакте', 'mdi-vk', '#0077FF', 'https://vk.com/', 2, 'Страница во ВКонтакте'),
    ('TELEGRAM_CHANNEL', 'Telegram канал', 'mdi-send', '#0088CC', 'https://t.me/', 3, 'Канал или группа в Telegram'),
    ('INSTAGRAM', 'Instagram', 'mdi-instagram', '#E4405F', 'https://instagram.com/', 4, 'Профиль в Instagram'),
    ('YOUTUBE', 'YouTube', 'mdi-youtube', '#FF0000', 'https://youtube.com/', 5, 'Канал на YouTube'),
    ('BLOG', 'Блог', 'mdi-post', NULL, 'https://', 6, 'Блог или личная страница'),
    ('LINKEDIN', 'LinkedIn', 'mdi-linkedin', '#0A66C2', 'https://linkedin.com/in/', 7, 'Профиль в LinkedIn'),
    ('GITHUB', 'GitHub', 'mdi-github', '#181717', 'https://github.com/', 8, 'Репозиторий или профиль на GitHub'),
    ('OTHER', 'Другое', 'mdi-link-variant', NULL, NULL, 99, 'Прочие ссылки (указывается custom_type_name)');
