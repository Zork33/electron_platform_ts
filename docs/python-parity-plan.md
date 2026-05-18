# План доведения `electron_platform_ts` до функционального паритета с `electron_platform`

Дата сравнения: 2026-05-18.

## Краткий вывод

`electron_platform_ts` уже покрывает основной видимый HTTP/WebSocket-контракт, который использует фронтенд: auth confirm-code flow, `person`, `user`, contact CRUD, file storage, file manager, object-container summary, WebSocket pool/debug routes. Фронтенд `front/` совпадает по набору файлов с Python-проектом, а SQL-миграции `db_migrator/main_db` перенесены.

Главный разрыв не во фронтенде, а в backend-семантике. Python backend работает через слои `lifecycle`, `toolkit`, `data_framework`, реальные таблицы PostgreSQL, MinIO file storage, JWT manager, Qdrant/search, image cropper, email/Telegram adapters и объектный контейнер с cleaner/statistics. TS backend сейчас реализует более компактную модель: Express routes + сервисы + snapshot persistence в JSON/PostgreSQL + MinIO blob adapter. Это достаточно для многих UI-сценариев, но не является полным портом поведения Python backend.

## Проверенное состояние

- Python tests: `python -m pytest` в `C:\work\stas001\electron_platform` -> `47 passed`.
- TS tests: `npm test` в `C:\work\stas001\electron_platform_ts\back` -> `12 test files`, `20 passed`.
- TS build: `npm run build` в `C:\work\stas001\electron_platform_ts\back` -> успешно.
- `front/`: набор файлов совпадает.
- `db_migrator/main_db`: набор миграций совпадает.
- `db_migrator/tests`: в TS отсутствуют тесты `test_renum.py`.

## Сравнение функциональности

| Область | `electron_platform` | `electron_platform_ts` | Статус |
|---|---|---|---|
| Frontend | Vue 3 + Quasar | тот же набор файлов | Паритет по структуре |
| HTTP framework | FastAPI | Express | Частичный паритет по API |
| API groups | `/user-api`, `/dev-api`, `/ws` | `/user-api`, `/dev-api`, `/health`, `/ws` | В основном покрыто |
| Generic CRUD | `data_framework.CrudElement` + `TableCrud` поверх PostgreSQL | `CrudCollection` + route/service layer | Нет полного DB-паритета |
| PostgreSQL | реальные доменные таблицы из миграций | snapshot state в PostgreSQL при `DB_HOST` | Критический разрыв |
| File storage | MinIO adapter + file manager + parts syncer | MinIO blob adapter + metadata snapshot | Частичный паритет |
| File collections/media | `file_collection`, `file_collection_item`, `FileCollection`, `MediaCollection` | event gallery и avatar-specific flows | Частичный/неполный |
| Auth confirm code | DB entity `user_auth_confirm_code`, reason/settings catalogs, history/result writer | in-service confirmation token records | Частичный паритет |
| Access tokens | JWT через `UserAuthJwtManager` и JWT encoder adapter | service token lifecycle, README указывает UUID-backed отличие | Нет паритета |
| Current user/session | validates request, user access/session expiry | access token lookup + current user DTO | Частичный паритет |
| Avatar upload | extension validation, Pillow image cropper, public storage path, previous avatar cleanup | upload/replace/delete/content без полного image processing parity | Частичный паритет |
| Person model/search | `gender_id`, vector fields, Qdrant dependency | нет `gender_id`/vector flags в type, local scoring search | Нет паритета |
| Catalogs | `gender`, `file_storage_part`, `user_auth_reason`, `phone_pattern` | часть данных зашита или отсутствует как CRUD/catalog services | Неполно |
| Object container | storage, statistics, cleaner, lifecycle handler | storage summary | Частичный паритет |
| Lifecycle | handlers для db, http, ws, file_storage, file_manager, image_cropper, email, telegram, env, cleanup | компактный server lifecycle | Нет 1:1 паритета |
| Toolkit/adapters | SQL DB, MinIO, JWT, email, Telegram, image cropper, websocket abstractions | частичные email/telegram compatibility stubs | Неполно |
| Error model | `ApplicationError` hierarchy and FastAPI exception handler | route-local JSON errors | Нет паритета |
| Security review docs | есть | есть | Перенесено |

## Сравнение тестов

### Python

Покрыто 47 тестами:

- auth service, request/ws auth, refresh access token;
- JWT manager payload/validation/expiry errors;
- confirm code generation, send/verify, result writer/history;
- application errors;
- object container storage/statistics/cleaner lifecycle;
- import sweep;
- migration renumber utility.

### TypeScript

Покрыто 20 тестами:

- auth service and auth API service;
- generic CRUD service;
- file storage and file API service;
- HTTP auth/crud/files/object-container/ws routes;
- object-container summary;
- persistence snapshot;
- profile service;
- store seed/token/file/ws lifecycle;
- websocket service;
- event/report gallery service.

### Разрывы в тестах

- Нет TS-аналога тестов `db_migrator/tests/test_renum.py`.
- Нет контрактных тестов, которые сравнивают ответы TS API с Python API по одинаковым fixtures.
- Нет тестов реальной PostgreSQL schema semantics: constraints, FK, unique indexes, soft delete, `updated_at` triggers.
- Нет тестов JWT compatibility с Python `UserAuthJwtManager`.
- Нет тестов полного confirm-code result writer lifecycle: `sending_at`, `verification_at`, `user_creation_at`, `access_token_created_at`, error fields.
- Нет тестов image cropper/avatar validation parity.
- Нет тестов MinIO part syncer и public/private/trash/registry parts behavior.
- Нет тестов Qdrant/vector-search parity.
- Нет тестов lifecycle/toolkit контейнера и обязательных dependency failures.

## Дорожная карта доработки

### Шаг 1. Зафиксировать контракт паритета

1. Составить machine-readable список Python endpoint contracts: method, path, query/body, response shape, status codes.
2. Сгенерировать или вручную описать fixtures для ключевых сценариев: registration, login, token refresh, CRUD, avatar, file storage, file manager, WebSocket, object container.
3. Добавить в TS `back/tests/contract/` тесты, которые проверяют именно Python-compatible response shapes, а не только текущую TS-реализацию.
4. Определить, какие TS-only endpoints оставить как расширения. Например, `/user-api/event/*` сейчас есть в TS, но не является явной частью Python backend.

### Шаг 2. Перевести TS persistence с snapshot на реальные таблицы

1. Реализовать PostgreSQL repository layer для таблиц из миграций: `person`, `"user"`, `stored_file`, `file_storage_part`, `file_collection`, `file_collection_item`, `user_auth_*`, `country`, `phone_pattern`, `phone_number`, `email`, `tg_acc`, `web_link_type`, `web_link`, `contact_info`.
2. Сохранить JSON/in-memory adapter только как dev/test fallback, но production mode должен работать с доменными таблицами, а не с одной snapshot-записью.
3. Поддержать soft delete, restore, hard delete, filters, sorting, pagination, batch operations, count, `get_id_by_code`.
4. Добавить тесты на FK/unique constraints и поведение `include_deleted`.
5. Проверить, что TS backend реально использует миграции `db_migrator/main_db`, а не держит параллельную модель данных.

### Шаг 3. Довести модели данных до схемы Python

1. Добавить в TS `Person` поля `gender_id`, `vector_db_record_id`, `is_vector_synced`.
2. Переименовать/сопоставить `User.session_expires_at` с Python-полем `auth_session_expires_at`, либо ввести compatibility mapping на API boundary.
3. Добавить полноценные catalog services для `gender`, `country`, `phone_pattern`, `file_storage_part`, `user_auth_reason`, `web_link_type`.
4. Проверить все DTO фронтенда и backend responses на совпадение с Python names/types.
5. Добавить миграционно-совместимые seed/default records вместо текущих demo records.

### Шаг 4. Реализовать Python-compatible CRUD framework

1. Спроектировать TS-аналог `CrudElement`/`Catalog`/`Entity` поверх repository layer.
2. Вынести generic CRUD behavior из route handlers в сервисы с одинаковой семантикой: required fields, validation, transactions, missing entity errors.
3. Поддержать custom storage для `User` и `UserAuthConfirmCode`, как в Python `UserStorage` и `UserAuthConfirmCodeStorage`.
4. Добавить route factory, аналогичный Python `api/http/factory/factory.py`, чтобы простые CRUD endpoints вели себя одинаково.

### Шаг 5. Довести auth до паритета

1. Заменить текущий TS access token формат на JWT-compatible flow: payload `user_id`, `expires_at`, `created_at`.
2. Реализовать adapter boundary для JWT encoder/decoder и ошибки `TOKEN_NOT_FOUND`, `INVALID_TOKEN_FORMAT`, `INVALID_TOKEN`, `TOKEN_MISSING_EXPIRY`, `TOKEN_MISSING_USER_ID`, `TOKEN_EXPIRED`.
3. Перенести confirm-code storage в таблицу `user_auth_confirm_code`.
4. Реализовать поля и transitions Python entity: `sending_at`, `is_sent`, `sending_error`, `verification_at`, `is_verified`, `user_creation_at`, `is_user_created`, `access_token_created_at`, `is_access_token_created`, `history`.
5. Реализовать settings через `user_auth_reason` и `user_auth_confirm_code_settings`, а не только env defaults.
6. Добавить контрактные тесты login/registration finish на создание пользователя, создание токена, ошибки верификации и лимиты попыток.

### Шаг 6. Довести file storage и file manager

1. Реализовать TS-аналог `FileStoragePart` catalog с `code`, `name`, `is_public`, constraints и public/private/trash/registry parts.
2. Реализовать part syncer behavior из `storage_schemas/file_storage/syncer.py`.
3. Перенести stored file metadata в таблицу `stored_file`, включая `object_key`, `file_storage_part_id`, filename/ext/content metadata.
4. Реализовать file manager semantics: upload, replace, delete, hard delete, restore, download, presigned URL, list pagination.
5. Реализовать `file_collection` и `file_collection_item` для generic file/media collections.
6. Добавить integration tests с MinIO-compatible adapter или test double, который проверяет object keys and part visibility.

### Шаг 7. Довести avatar/image processing

1. Реализовать image cropper adapter, совместимый с Python `image_cropper_pillow`: validate extension, reject empty file, process image with `fit_mode="contain"`.
2. Ограничить avatar extensions до `jpg`, `jpeg`, `png`, `webp`.
3. Соблюсти storage path `user/{id}/avatar/avatar_{user_id}.{ext}`.
4. При замене удалять предыдущий avatar metadata/content по той же семантике, что Python.
5. Добавить тесты upload/replace/delete/content, invalid extension, empty file, cleanup previous avatar.

### Шаг 8. Довести person search до Qdrant/vector parity

1. Добавить adapter boundary для vector DB, совместимый с Python dependency `qdrant-client`.
2. Синхронизировать `person.description`/profile text в vector DB и обновлять `vector_db_record_id`, `is_vector_synced`.
3. Сохранить local trigram search только как fallback/dev mode.
4. Добавить тесты: vector sync on create/update/delete, search score threshold, fallback mode.

### Шаг 9. Довести object container

1. Реализовать object storage entries, metadata, validation and duplicate handling как в Python `object_container`.
2. Реализовать cleaner state/logs/statistics, а не только summary.
3. Добавить endpoints `/dev-api/object-container/cleaner-info`, `/container-info`, `/all-statistics`.
4. Добавить тесты, соответствующие Python `test_object_container.py`.

### Шаг 10. Довести WebSocket behavior

1. Сверить handshake/auth с Python `/ws`: token source, error handling, close codes.
2. Проверить формат pool info и debug messages для `/dev-api/web-socket/*`.
3. Реализовать adapter/tool boundary для WebSocket, если нужен parity с `toolkit/tool/web_socket/tool.py`.
4. Добавить тесты invalid/expired token, send-all, send-user, send-connection, disconnect cleanup.

### Шаг 11. Довести lifecycle/toolkit слой

1. Решить архитектурно: нужен ли 1:1 порт Python hierarchy или достаточно совместимых interfaces. Для полного паритета нужен хотя бы compatibility layer.
2. Реализовать lifecycle handlers: env, db, http server, websocket server, file storage, file manager, image cropper, email sender, user auth JWT manager, object container cleanup.
3. Реализовать toolkit abstractions/adapters для SQL DB, file storage, email sender, Telegram bot, JWT encoder, image cropper.
4. Добавить startup/shutdown tests: missing dependencies, init order, graceful stop.

### Шаг 12. Довести error handling и validation

1. Перенести error code/status model из Python `system/errors.py`.
2. Сделать единый Express error middleware, который возвращает Python-compatible JSON error shape.
3. Заменить route-local `badRequest/notFound/unauthorized` на typed errors.
4. Добавить тесты всех error subclasses и HTTP mapping.

### Шаг 13. Вернуть тесты мигратора

1. Скопировать или переиспользовать `db_migrator/tests/test_renum.py` в TS-проект.
2. Настроить Python test command для `db_migrator` внутри `electron_platform_ts`.
3. Добавить CI command, который запускает `npm test`, `npm run build` и `python -m pytest db_migrator/tests`.

### Шаг 14. Интеграционные проверки через Docker Compose

1. Поднять `docker compose up --build` с PostgreSQL, db migrator, MinIO, backend, frontend.
2. Запустить smoke suite против реального `http://localhost:8000`.
3. Проверить, что после restart backend сохраняет данные в доменных таблицах и файлы в MinIO.
4. Проверить, что frontend scenarios работают без fallback state.

### Шаг 15. Финальная матрица приемки

1. Все Python tests имеют TS-аналог или явное обоснование, почему аналог не нужен.
2. Все Python endpoints имеют TS contract tests.
3. TS backend использует те же SQL migrations and domain tables.
4. Auth tokens совместимы по JWT payload/errors.
5. File/avatar flows совпадают по storage paths, metadata, validation and cleanup.
6. Object container endpoints and cleaner/statistics совпадают.
7. Qdrant/vector search либо реализован, либо явно отключается feature flag с documented fallback.
8. `npm run build`, `npm test`, `python -m pytest db_migrator/tests` проходят.

## Рекомендуемый порядок выполнения

1. Сначала сделать контрактные тесты и DB repository layer. Без этого остальные доработки будут проверять текущую TS-модель, а не паритет с Python.
2. Затем auth/JWT и confirm-code, потому что они влияют на защищенные endpoints и WebSocket.
3. Затем file storage/file manager/avatar, потому что они завязаны на DB и MinIO.
4. Затем object container, Qdrant search, lifecycle/toolkit.
5. Последним проходом закрыть error model, CI и Docker smoke tests.

