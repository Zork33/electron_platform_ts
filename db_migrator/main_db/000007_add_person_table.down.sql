-- =====================================================
-- Откат создания таблицы person
-- =====================================================

DROP INDEX IF EXISTS person_gender_id_idx;
DROP TRIGGER IF EXISTS trigger_update_person_updated_at ON person;
DROP TABLE IF EXISTS person;
