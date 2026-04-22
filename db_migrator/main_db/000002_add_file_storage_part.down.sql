-- =====================================================
-- Откат создания справочника разделов файлового хранилища
-- =====================================================

DROP INDEX IF EXISTS file_storage_part_name_idx;
DROP INDEX IF EXISTS file_storage_part_title_idx;
DROP INDEX IF EXISTS file_storage_part_code_idx;
DROP TRIGGER IF EXISTS update_file_storage_part_updated_at ON file_storage_part;
DROP TABLE IF EXISTS file_storage_part;
