-- =====================================================
-- Откат создания справочника телефонных паттернов
-- =====================================================

DROP INDEX IF EXISTS phone_pattern_country_phone_code_idx;
DROP INDEX IF EXISTS phone_pattern_country_id_idx;
DROP INDEX IF EXISTS phone_pattern_code_idx;
DROP TRIGGER IF EXISTS update_phone_pattern_updated_at ON phone_pattern;
DROP TABLE IF EXISTS phone_pattern;
