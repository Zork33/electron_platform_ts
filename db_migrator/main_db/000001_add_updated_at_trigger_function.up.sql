-- =====================================================
-- Создание функции-триггера для обновления updated_at
-- =====================================================

-- Функция-триггер для автоматического обновления поля updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now(); 
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Комментарий к функции
COMMENT ON FUNCTION update_updated_at_column() IS 'Функция-триггер, которая устанавливает текущее время в поле updated_at при обновлении строки.';
