#!/bin/sh

# Скрипт для управления миграциями внутри контейнера db_migrator
# Использование: ./migrate-postgresql.sh <database_name> <migrate_command> [args...]
# Пример: ./migrate-postgresql.sh main_db create add_users_table

echo "📋 Аргументы: $@"

# Проверяем, что передано название БД
if [ -z "$1" ]; then
    echo "❌ Не указано название БД!"
    echo ""
    echo "Использование: ./migrate-postgresql.sh <database_name> <migrate_command> [args...]"
    echo ""
    echo "Доступные БД:"
    echo "  main_db      - основная БД приложения"
    echo "  analytic_db  - аналитическая БД"
    echo ""
    echo "Примеры:"
    echo "  ./migrate-postgresql.sh main_db create add_users_table"
    echo "  ./migrate-postgresql.sh main_db up"
    echo "  ./migrate-postgresql.sh analytic_db down 2"
    echo "  ./migrate-postgresql.sh main_db version"
    exit 1
fi

DATABASE_NAME="$1"
shift  # Удаляем название БД из аргументов

# Загружаем переменные из .env (должны быть уже загружены в окружение)
echo "📄 Используем переменные окружения из .env"

# Строим параметры БД на основе переданной БД
case "$DATABASE_NAME" in
  "main_db")
    DB_USER=${DB_USER:-postgres}
    DB_PASSWORD=${DB_PASSWORD:-postgres}
    DB_NAME=${DB_NAME:-main_db}
    DB_HOST=${DB_HOST:-main_db}
    DB_PORT=${DB_PORT:-5432}
    MIGRATIONS_PATH="/migrations/main_db"
    echo "🗄️ Работаем с main_db (${DB_NAME})"
    ;;
  "analytic_db")
    DB_USER=${ANALYTIC_DB_USER:-postgres}
    DB_PASSWORD=${ANALYTIC_DB_PASSWORD:-postgres}
    DB_NAME=${ANALYTIC_DB_NAME:-analytic_db}
    DB_HOST=${ANALYTIC_DB_HOST:-analytic_db}
    DB_PORT=${ANALYTIC_DB_PORT:-5432}
    MIGRATIONS_PATH="/migrations/analytic_db"
    echo "📊 Работаем с analytic_db (${DB_NAME})"
    ;;
  *)
    echo "❌ Неизвестная БД: $DATABASE_NAME"
    echo "Доступные БД: main_db, analytic_db"
    exit 1
    ;;
esac

# Создаем директорию для миграций если её нет
mkdir -p "$MIGRATIONS_PATH"

# Строим URL подключения к БД
DB_URL="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable"

# Проверяем, что передана команда для migrate
if [ -z "$1" ]; then
    echo "❌ Не указана команда для migrate!"
    echo ""
    echo "Доступные команды:"
    echo "  create <name>     - создать новую миграцию"
    echo "  up               - применить все миграции"
    echo "  down [N]         - откатить N миграций (по умолчанию 1)"
    echo "  goto <version>   - перейти к определённой версии"
    echo "  force <version>  - принудительно установить версию"
    echo "  version          - показать текущую версию"
    echo "  drop             - удалить все таблицы (ОПАСНО!)"
    exit 1
fi

MIGRATE_COMMAND="$1"
shift  # Удаляем команду из аргументов

# Специальная обработка для команды drop
if [ "$MIGRATE_COMMAND" = "drop" ]; then
    echo "⚠️ ВНИМАНИЕ: Это удалит ВСЕ таблицы в БД $DATABASE_NAME!"
    echo "Введите название БД '$DATABASE_NAME' для подтверждения:"
    read confirmation
    if [ "$confirmation" != "$DATABASE_NAME" ]; then
        echo "❌ Операция отменена"
        exit 1
    fi
    echo "🗑️ Удаляем все таблицы..."
fi

# Выполняем команду migrate напрямую
if [ "$MIGRATE_COMMAND" = "create" ]; then
    echo "🚀 Создаем миграцию: $@"
    migrate create -ext sql -dir "$MIGRATIONS_PATH" -seq "$@"
else
    echo "🚀 Выполняем: migrate $MIGRATE_COMMAND $@"
    migrate -path "$MIGRATIONS_PATH" -database "$DB_URL" -verbose $MIGRATE_COMMAND "$@"
fi

if [ $? -eq 0 ]; then
    echo "✅ Команда выполнена успешно!"
    if [ "$MIGRATE_COMMAND" = "create" ]; then
        echo "📁 Файлы созданы в: $MIGRATIONS_PATH"
        ls -la "$MIGRATIONS_PATH"
    fi
else
    echo "❌ Произошла ошибка при выполнении команды"
    exit 1
fi