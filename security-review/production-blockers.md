# Что точно надо исправить до production

Это список блокеров. Пока они не закрыты, проект нельзя безопасно выкатывать в публичный production.

## 1. Убрать секреты и дефолтные пароли из `.env_example`

Риск: `Critical`

В `.env_example` сейчас есть значения, которые выглядят как рабочие секреты или слабые дефолтные пароли:

- `DB_PASSWORD=Dbpass123`
- `USER_AUTH_JWT_SECRET_KEY=...`
- `FILE_STORAGE_ROOT_USER_LOGIN=admin`
- `FILE_STORAGE_ROOT_USER_PASSWORD=FilestoragePass123`
- `FILE_STORAGE_CLIENT_LOGIN=admin`
- `FILE_STORAGE_CLIENT_PASSWORD=FilestoragePass123`

Что исправить:

- заменить на placeholder-значения без реальных секретов;
- добавить проверку startup, запрещающую production-запуск с дефолтными значениями;
- развести root-credentials MinIO и credentials backend-клиента;
- хранить production-секреты только в secret manager или защищенном окружении.

## 2. Убрать логирование OTP-кодов, токенов и чувствительных данных

Риск: `Critical`

В auth flow есть вывод в logs:

- confirmation token;
- confirm code;
- access token prefix;
- email пользователя;
- ожидаемый код подтверждения.

Особенно опасные места:

- `back/src/logic/process/auth/registration/confirm_code/process.py`
- `back/src/api/http/routes/user_api/auth/login_confirm_code.py`
- `back/src/api/http/routes/user_api/auth/registration_confirm_code.py`
- `back/src/api/http/routes/user_api/auth/access_token_refresh.py`

Что исправить:

- перейти на структурный logging с уровнями;
- запретить логирование секретов, OTP и токенов;
- маскировать email и user identifiers;
- добавить тест или grep-check на опасные log statements.

## 3. Исправить refresh token model

Риск: `Critical`

Текущий endpoint `/user-api/auth/access-token-refresh` обновляет access token на основании текущего access token. Это превращает access token в refresh token и продлевает сессию при компрометации access token.

Что исправить:

- ввести отдельный refresh token;
- хранить refresh token server-side или хранить его хэш;
- добавить rotation refresh token при каждом использовании;
- уметь отзывать refresh-сессии;
- не продлевать long-lived session только по access token.

## 4. Закрыть IDOR в user/avatar endpoints

Риск: `Critical`

Ручки вида `/{user_id:int}/avatar/upload`, `replace`, `delete`, `content` работают по `user_id` из URL. Middleware проверяет факт авторизации, но в самих ручках не видно проверки, что текущий пользователь имеет право менять или читать ресурс указанного `user_id`.

Что исправить:

- сравнивать `request.state.user.id` с `user_id`;
- разрешать чужой `user_id` только admin-роли;
- вынести проверку владения ресурса в общий policy/helper;
- добавить тест: обычный пользователь не может менять аватар другого пользователя.

## 5. Закрыть IDOR в file storage endpoints

Риск: `Critical`

Файловые ручки принимают `storage_part_name` и `path` от клиента:

- upload;
- download;
- delete;
- info;
- presigned-url.

В коде не видно проверки владельца файла, привязки к пользователю или policy на конкретный storage part/path.

Что исправить:

- запретить прямой произвольный `storage_part_name` и `path` из клиента;
- выдавать доступ только к файлам, связанным с доменной записью и владельцем;
- проверять права перед download/delete/presigned-url;
- ограничить `expires_in` для presigned URL;
- вести аудит выдачи presigned URL.

## 6. Ограничить generic CRUD

Риск: `Critical`

`Factory.create_logic_element_crud_router` принимает `data: dict` и прокидывает его в entity CRUD. Это опасно для публичных user-api ручек:

- клиент может попытаться менять системные поля;
- нет явных request schemas;
- нет field-level authorization;
- фильтры и сортировки принимают имена полей от клиента.

Что исправить:

- заменить `dict` на явные Pydantic-модели create/update;
- задать allowlist полей для фильтров, сортировки и update;
- запретить изменение `id`, `created_at`, `updated_at`, `deleted_at`, `is_admin`, `has_access`, ownership-полей обычным пользователем;
- добавить route-level и entity-level authorization.

## 7. Выключить `uvicorn --reload` в production

Риск: `High`

`back/Dockerfile` запускает backend через:

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

`--reload` предназначен для разработки и не должен использоваться в production.

Что исправить:

- сделать отдельный production Dockerfile или command;
- убрать bind mount кода в production compose;
- запускать через production ASGI command без reload;
- добавить healthcheck.

## 8. Не публиковать БД и MinIO наружу в production

Риск: `High`

`docker-compose.yml` публикует наружу:

- PostgreSQL: `5433:5432`
- MinIO API: `9000:9000`
- MinIO Console: `9001:9001`

Что исправить:

- для production не публиковать DB и MinIO напрямую;
- оставить доступ только внутри Docker network/VPC;
- MinIO Console закрыть VPN, SSO или отдельной admin-сетью;
- использовать отдельный production compose.

## 9. Улучшить хранение токенов на frontend

Риск: `High`

Access token хранится в cookie, которую выставляет JavaScript. Такая cookie не может быть `HttpOnly`, значит токен доступен при XSS. Параметр `Secure` тоже не выставлен.

Что исправить:

- перейти на server-set `HttpOnly Secure SameSite` cookies;
- не хранить access token в JS-readable storage;
- добавить CSRF-модель, если auth будет cookie-based;
- включить CSP для снижения XSS-риска.

## 10. Добавить security-тесты до релиза

Риск: `High`

Сейчас в `back/tests` только `.gitkeep`. Для production нужно минимум покрыть:

- обычный пользователь не может читать/менять чужого пользователя;
- обычный пользователь не может получить чужой файл или presigned URL;
- refresh невозможен без refresh token;
- OTP нельзя использовать после лимита попыток и истечения TTL;
- dev-api закрыт в production;
- production не стартует с дефолтными секретами.

