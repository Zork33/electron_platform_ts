# Рекомендации по улучшению безопасности

## 1. Auth и sessions

### Разделить access token и refresh token

Сейчас refresh endpoint принимает текущий access token. Нужно ввести полноценную session model:

- короткоживущий access token;
- долгоживущий refresh token;
- хранение хэша refresh token на backend;
- rotation refresh token;
- отзыв конкретной сессии;
- аудит входов и refresh-событий.

### Уточнить JWT claims

Рекомендуется добавить стандартные claims:

- `sub`;
- `iat`;
- `exp`;
- `jti`;
- `iss`;
- `aud`.

Сейчас используется кастомный `expires_at`. Лучше перейти на стандартный `exp`, чтобы PyJWT валидировал срок действия штатно.

### Хэшировать OTP-коды

`confirm_code` хранится как открытый текст. Это надо заменить на хэш:

- генерировать код;
- отправлять пользователю;
- хранить только hash + salt или HMAC;
- сравнивать через constant-time compare;
- удалять/инвалидировать код после успешного использования.

## 2. Authorization и ownership

### Ввести policy layer

Проверка "пользователь имеет доступ к ресурсу" должна быть явной и повторно используемой:

- `can_read_user(current_user, target_user_id)`;
- `can_update_user(current_user, target_user_id)`;
- `can_access_file(current_user, file_id/path)`;
- `can_use_storage_part(current_user, part)`.

### Закрыть generic CRUD от прямого публичного доступа

Generic CRUD удобен для разработки, но опасен как public API. Для production нужны конкретные endpoints с явными схемами и правами.

Минимум:

- allowlist writable fields;
- allowlist readable fields;
- allowlist filters/order fields;
- запрет `include_deleted` для обычных пользователей;
- запрет direct update системных полей.

## 3. File storage

### Убрать прямой доступ по произвольному path

Клиент не должен сам выбирать любой `storage_part_name` и `path`. Надёжнее работать через доменные file IDs:

- пользователь запрашивает файл по ID;
- backend проверяет права;
- backend сам резолвит bucket/path;
- backend скачивает файл или выдаёт короткий presigned URL.

### Ограничить presigned URL

Рекомендуется:

- установить максимальный TTL, например 60-300 секунд для приватных файлов;
- запрещать presigned URL для чужих файлов;
- логировать выдачу URL без записи полного URL в logs;
- не показывать presigned URL в UI дольше срока жизни;
- не выдавать URL для public/trash/private частей без policy.

## 4. Frontend security

### Перейти на HttpOnly cookies

Текущая JS-readable cookie с access token уязвима при XSS.

Рекомендуемая модель:

- refresh token в `HttpOnly Secure SameSite` cookie;
- access token либо в памяти приложения, либо тоже через cookie при понятной CSRF-модели;
- logout удаляет server-side session;
- frontend не читает refresh token.

### Добавить CSP

Нужно ввести Content Security Policy:

- запрет inline scripts;
- ограничить `connect-src` backend, WebSocket и MinIO;
- ограничить `img-src`;
- запретить произвольные external origins.

## 5. WebSocket

### Не передавать access token в query string

Сейчас WebSocket URL строится как `/ws?token=...`. Query token часто попадает в logs, browser history, reverse proxy logs и observability.

Лучше:

- использовать cookie-based auth;
- или короткоживущий одноразовый websocket ticket;
- или subprotocol/header-модель там, где это возможно.

### Ограничить входящие WS-сообщения

Нужно добавить:

- Pydantic-схемы сообщений;
- allowlist типов сообщений;
- rate limit на соединение;
- лимит размера payload;
- heartbeat timeout и лимит одновременных подключений на пользователя.

## 6. Infrastructure

### Разделить dev и prod конфигурации

Текущий `docker-compose.yml` удобен для разработки. Для production нужен отдельный профиль:

- без `--reload`;
- без bind mounts исходников;
- без публикации DB/MinIO наружу;
- с healthchecks;
- с non-root пользователями;
- с pinned image versions;
- с ресурсными лимитами.

### Пиновать зависимости

`back/requirements.txt` содержит много незакрепленных версий. Это усложняет reproducible builds и vulnerability management.

Рекомендуется:

- pin exact versions;
- использовать lock-файл или pip-tools/uv;
- добавить dependency scanning в CI;
- регулярно обновлять PyJWT, FastAPI, Starlette, Pillow, MinIO client.

## 7. Observability и incident readiness

### Заменить `print` на logging

Нужен единый logger:

- уровни `debug/info/warning/error`;
- correlation/request ID;
- redaction секретов;
- no-token/no-OTP logging policy.

### Добавить audit events

Полезные события:

- login start/finish;
- registration finish;
- failed OTP attempt;
- token refresh;
- file download;
- presigned URL issued;
- admin action;
- access denied.

## 8. Security CI

Минимальный набор:

- `pip-audit` или аналог для Python;
- `npm audit` или SCA;
- secret scanning;
- Semgrep/Bandit для backend;
- eslint security rules для frontend;
- тесты authz и IDOR.

## Предлагаемый порядок работ

1. Убрать секреты и опасные logs.
2. Закрыть IDOR по user/avatar и file storage.
3. Переделать refresh token модель.
4. Ограничить generic CRUD.
5. Разделить dev/prod compose и Dockerfile.
6. Перевести tokens на HttpOnly Secure cookie model.
7. Добавить security tests и CI scanning.

