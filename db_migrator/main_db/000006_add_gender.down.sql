-- =====================================================
-- Откат создания справочника пола
-- =====================================================

DROP INDEX IF EXISTS gender_title_idx;
DROP INDEX IF EXISTS gender_code_idx;
DROP TRIGGER IF EXISTS update_gender_updated_at ON gender;
DROP TABLE IF EXISTS gender;
