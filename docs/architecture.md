# TypeScript Architecture

`electron_platform_ts` is the TypeScript rewrite of the original `electron_platform` project. The frontend keeps the original HTTP and WebSocket contracts. The backend now uses PostgreSQL and MinIO adapters at runtime, while local development and tests can still fall back to JSON and in-memory stores.

## Layout

```text
electron_platform_ts/
  back/                 TypeScript backend: Express, ws, Vitest
  front/                Vue 3 + Quasar frontend
  docs/                 project documentation
  db_migrator/          legacy migration artifacts from the original project
  security-review/      legacy security review artifacts
  docker-compose.yml    local container startup
```

Backend runtime source lives in `back/src` and compiles to `back/dist`.

## Backend

The backend is organized around an Express app and a WebSocket server:

- `app.ts` creates the Express app, mounts `/user-api`, `/dev-api`, `/health`, and attaches WebSocket authentication.
- `index.ts` starts the HTTP server, the `/ws` WebSocket server, and the periodic ping loop.
- `routes.ts` defines the HTTP routes and delegates to services.
- `store.ts` is the composition root. It wires collections, services, and the persistence adapters.
- `types.ts` defines the shared DTO and domain shapes.

### Services

The service layer is split into small modules:

- `auth-service.ts` - confirmation codes, access tokens, refresh and logout flows.
- `auth-api-service.ts` - HTTP-facing auth orchestration.
- `profile-service.ts` - `person`, `user`, `current-user`, avatar flow, and person search.
- `crud-api-service.ts` - shared CRUD adapter for simple collections.
- `file-storage.ts` - file parts and stored files with blob-store support.
- `file-api-service.ts` - HTTP-oriented file-storage and file-manager operations.
- `event-service.ts` - events and report gallery handling.
- `object-container.ts` - aggregated storage summary.
- `ws-service.ts` - WebSocket connection tracking and message routing.
- `record-collection.ts` - generic CRUD collection with soft delete and restore.
- `time.ts` - ISO time helpers.

`store.ts` does not own route logic. It composes the services and persists a snapshot whenever data changes.

## HTTP API

The main API groups are:

- `/user-api/auth/*` - login and registration confirmation flow, token refresh, logout.
- `/user-api/user/*` - users, current user, avatar endpoints.
- `/user-api/person/*` - persons, filters, and vector-style search.
- `/user-api/contact-info/*`, `/phone-number/*`, `/email/*`, `/tg-acc/*`, `/web-link/*` - generic CRUD.
- `/user-api/event/*` - events and report gallery.
- `/user-api/file-storage/*` - storage parts and path-based file operations.
- `/user-api/file-manager/*` - file manager endpoints for stored files.
- `/dev-api/file-storage/*` - file storage helpers.
- `/dev-api/object-container/storage-info` - storage summary.
- `/dev-api/web-socket/*` - WebSocket pool and debug send routes.
- `/health` - service health.

The route contracts match the frontend expectations. The implementation is smaller than the original Python service stack, but the visible API surface is preserved.

## Persistence

The backend persistence layer is split into two adapters:

- `JsonAppStateStore` is the local fallback for development and tests.
- `PostgresAppStateStore` stores the application snapshot in PostgreSQL when `DB_*` env vars are present.

File content is handled by a blob store adapter:

- `MemoryBlobStore` is the local fallback.
- `MinioBlobStore` stores file content in MinIO when `FILE_STORAGE_*` env vars are present.

The application snapshot includes collection data, auth state, and file metadata. File blobs are restored from MinIO when available, with base64 fallback inside the snapshot for resilience.

The snapshot file path used by the JSON fallback is `back/data/state.json`.

WebSocket connection state remains runtime-only, because live sockets cannot be restored after process restart.

## WebSocket

WebSocket endpoint: `/ws?token=<access-token>`.

Connection flow:

1. `attachWebSocketServer()` reads `token` from query params.
2. `AuthService` resolves the user by access token.
3. `WebSocketService` registers the connection and keeps a socket adapter.
4. The server sends a `connected` debug frame.
5. Client `pong` frames update `last_pong_at`.
6. `index.ts` sends periodic `ping` frames and updates `last_ping_at`.

## Frontend

`front/` is the Vue 3 + Quasar application kept from the original project. It talks to the backend through the same API groups listed above.

## Docker

`docker-compose.yml` defines:

- `back` on port `8000`
- `front` on port `8080`
- `db`, `db-migrator`, and `file-storage` to mirror the original topology

The backend service receives `DB_*` and `FILE_STORAGE_*` env vars from compose, so it binds to PostgreSQL and MinIO at runtime.

## Testing

Backend tests use Vitest:

```sh
cd back
npm test
npm run test:coverage
```

Coverage output is written to `back/coverage`.

## Remaining Gaps

The TS rewrite still differs from the original backend in a few places:

- Access tokens are UUID-backed in the TS auth service rather than the Python auth stack.
- Person search uses local trigram-style scoring instead of Qdrant.
- Email and Telegram integrations are still embedded service logic, not external adapters.
- The full Python lifecycle/toolkit/process hierarchy is not ported 1:1.
- WebSocket connection state is runtime-only and does not survive a restart.

The backend is otherwise much closer to the original because state and file blobs now flow through external adapters, while local development and tests can still use the JSON and memory fallbacks.
