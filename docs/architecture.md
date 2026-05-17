# Архитектура TypeScript-проекта

`electron_platform_ts` - TypeScript-перенос исходного `electron_platform`. Сейчас проект сохраняет основные HTTP/WebSocket контракты фронтенда, но backend работает как in-memory реализация без PostgreSQL, MinIO, Qdrant и Python service-layer.

## Общая структура

```text
electron_platform_ts/
  back/                 TypeScript backend: Express, ws, Vitest
  front/                Vue 3 + Quasar frontend
  docs/                 проектная документация
  db_migrator/          legacy-артефакты исходного проекта
  security-review/      legacy-артефакты анализа
  docker-compose.yml    запуск backend и frontend контейнерами
```

Backend находится в `back/src`. Текущие runtime-файлы написаны на TypeScript и собираются в `back/dist`.

## Backend

Backend построен вокруг Express-приложения и WebSocket-сервера:

- `app.ts` создает Express-приложение, подключает `/user-api`, `/dev-api`, `/health` и WebSocket auth handler.
- `index.ts` запускает HTTP-сервер, WebSocketServer на `/ws` и периодический ping для активных соединений.
- `routes.ts` содержит HTTP-маршруты и связывает их с сервисами.
- `store.ts` является композиционным корнем: создает коллекции, сервисы и seed-данные.
- `types.ts` описывает основные DTO и доменные структуры.

### Сервисы

Сервисный слой вынесен в отдельные модули:

- `auth-service.ts` - confirmation codes, access tokens, token refresh, logout.
- `auth-api-service.ts` - прикладной auth flow для HTTP-ручек.
- `profile-service.ts` - `person`, `user`, `current-user`, avatar flow, user provisioning.
- `crud-api-service.ts` - общий CRUD adapter для простых коллекций.
- `file-storage.ts` - in-memory файловое хранилище, parts, metadata, soft/hard delete.
- `file-api-service.ts` - HTTP-oriented операции file-storage и file-manager.
- `event-service.ts` - события и report gallery.
- `object-container.ts` - агрегированная информация по хранилищу.
- `ws-service.ts` - WebSocket connections, sockets, broadcast/send.
- `record-collection.ts` - generic in-memory CRUD collection с soft delete и restore.
- `time.ts` - helpers для ISO-времени.

`store.ts` не содержит бизнес-логики маршрутов. Он только собирает зависимости, создает коллекции и предоставляет singleton `store` для текущей in-memory реализации.

## HTTP API

Основные группы маршрутов:

- `/user-api/auth/*` - login/registration confirmation code flow, token refresh, logout.
- `/user-api/user/*` - users, current user, avatars.
- `/user-api/person/*` - persons, list filters, vector search stub.
- `/user-api/contact-info`, `/phone-number`, `/email`, `/tg-acc`, `/web-link` - generic CRUD.
- `/user-api/event/*` - events and report gallery.
- `/user-api/file-storage/*` - storage parts and path-based file operations.
- `/user-api/file-manager/*` - file manager API over stored files.
- `/dev-api/file-storage/*` - dev/admin file storage helpers.
- `/dev-api/object-container/storage-info` - storage summary.
- `/dev-api/web-socket/*` - WebSocket pool and debug sends.
- `/health` - service health.

Responses intentionally mirror the contracts that frontend already expects. Some implementation details are simplified compared to the Python backend.

## WebSocket

WebSocket endpoint: `/ws?token=<access-token>`.

Connection flow:

1. `attachWebSocketServer()` reads `token` from query params.
2. `AuthService` resolves the user by access token.
3. `WebSocketService` registers the connection and stores a socket adapter.
4. The server sends a `connected` debug frame.
5. Client `pong` frames update `last_pong_at`.
6. `index.ts` sends periodic `ping` frames and updates `last_ping_at`.

Dev routes can broadcast messages to all sockets, a user, or a specific connection.

## Data Model And Persistence

The current backend is intentionally in-memory:

- All records live in `CrudCollection` instances.
- Files live in `FileStorageService` memory maps.
- Auth tokens and confirmation records live in `AuthService`.
- WebSocket state lives in `WebSocketService`.
- `store.reset()` clears runtime state and recreates the demo user.

This means data disappears when the backend process restarts. The current implementation is useful for frontend/API compatibility and TS migration work, but it is not a production persistence layer.

## Frontend

`front/` is the Vue 3 + Quasar application preserved from the original project. It talks to the backend through the same API groups listed above. The backend rewrite focuses on keeping those contracts usable while Python infrastructure is being replaced.

Common commands:

```powershell
cd front
yarn install
yarn dev
```

## Docker

`docker-compose.yml` currently defines:

- `back` on port `8000`
- `front` on port `8080`

The compose file is aligned with the TS backend and does not start PostgreSQL, MinIO, Qdrant or the old Python backend.

## Testing

Backend tests use Vitest:

```powershell
cd back
npm test
npm run test:coverage
```

Tests cover service modules and HTTP/WebSocket flows. Coverage is generated in `back/coverage`.

## Current Limitations

The TS rewrite does not yet include these original Python integrations:

- PostgreSQL persistence and migrations as runtime backend storage.
- MinIO object storage.
- Qdrant vector search.
- Real email sender / Telegram bot adapters.
- Production JWT signing and external auth storage.
- Full Python lifecycle/toolkit/object-container architecture.

The intended next architecture step is to keep the current service boundaries and replace in-memory adapters with persistent implementations behind the same service APIs.
