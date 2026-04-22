-- =====================================================
-- Откат создания таблицы контактной информации
-- =====================================================

DROP INDEX IF EXISTS contact_info_is_primary_idx;
DROP INDEX IF EXISTS contact_info_web_link_id_idx;
DROP INDEX IF EXISTS contact_info_email_id_idx;
DROP INDEX IF EXISTS contact_info_tg_acc_id_idx;
DROP INDEX IF EXISTS contact_info_phone_number_id_idx;
DROP INDEX IF EXISTS contact_info_person_id_idx;
DROP TRIGGER IF EXISTS trigger_update_contact_info_updated_at ON contact_info;
DROP TABLE IF EXISTS contact_info;
