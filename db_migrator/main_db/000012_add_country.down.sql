-- =====================================================
-- Откат создания справочника стран
-- =====================================================

DROP INDEX IF EXISTS country_title_idx;
DROP INDEX IF EXISTS country_code_idx;
DROP TRIGGER IF EXISTS update_country_updated_at ON country;
DROP TRIGGER IF EXISTS trigger_country_generate_title ON country;
DROP FUNCTION IF EXISTS country_generate_title();
DROP TABLE IF EXISTS country;
