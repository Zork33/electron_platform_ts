-- =====================================================
-- Откат создания таблицы телефонных номеров
-- =====================================================

DROP INDEX IF EXISTS phone_number_pattern_id_idx;
DROP INDEX IF EXISTS phone_number_full_idx;
DROP TRIGGER IF EXISTS trigger_update_phone_number_updated_at ON phone_number;
DROP TRIGGER IF EXISTS trigger_phone_number_generate_full ON phone_number;
DROP FUNCTION IF EXISTS phone_number_generate_full();
DROP TABLE IF EXISTS phone_number;
