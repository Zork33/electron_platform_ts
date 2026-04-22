-- =====================================================
-- Откат создания таблицы хранимых файлов
-- =====================================================

DROP INDEX IF EXISTS stored_file_deleted_at_idx;
DROP INDEX IF EXISTS stored_file_file_storage_part_id_idx;
DROP TRIGGER IF EXISTS trigger_update_stored_file_updated_at ON stored_file;
DROP TABLE IF EXISTS stored_file;
