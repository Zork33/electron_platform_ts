-- =====================================================
-- Откат создания таблицы Telegram аккаунтов
-- =====================================================

DROP INDEX IF EXISTS tg_acc_phone_number_id_idx;
DROP INDEX IF EXISTS tg_acc_username_idx;
DROP INDEX IF EXISTS tg_acc_user_id_idx;
DROP TRIGGER IF EXISTS trigger_update_tg_acc_updated_at ON tg_acc;
DROP TABLE IF EXISTS tg_acc;
