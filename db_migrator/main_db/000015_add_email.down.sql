-- =====================================================
-- Откат создания таблицы email адресов
-- =====================================================

DROP INDEX IF EXISTS email_address_idx;
DROP TRIGGER IF EXISTS trigger_update_email_updated_at ON email;
DROP TABLE IF EXISTS email;
