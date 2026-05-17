# TypeScript Architecture

`electron_platform_ts` is the TypeScript rewrite of the original `electron_platform` project. The frontend keeps the original HTTP and WebSocket contracts, while the backend now persists application state to a local JSON snapshot under `back/data/state.json`.

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
- `store.ts` is the composition root. It wires collections, services, and the persistent state file.
- `types.ts` defines the shared DTO and domain shapes.

### Services

The service layer is split into small modules:

- `auth-service.ts` - confirmation codes, access tokens, refresh and logout flows.
- `auth-api-service.ts` - HTTP-facing auth orchestration.
- `profile-service.ts` - `person`, `user`, `current-user`, avatar flow, and person search.
- `crud-api-service.ts` - shared CRUD adapter for simple collections.
- `file-storage.ts` - file parts and stored files with persistent snapshot support.
- `file-api-service.ts` - HTTP-oriented file-storage and file-manager operations.
- `event-service.ts` - events and report gallery handling.
- `object-container.ts` - aggregated storage summary.
- `ws-service.ts` - WebSocket connection tracking and message routing.
- `record-collection.ts` - generic CRUD collection with soft delete and restore.
- `time.ts` - ISO time helpers.

`store.ts` does not own route logic. It composes the services and persists a full application snapshot whenever data changes.

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

The backend now keeps durable local state:

- Collections are stored in `CrudCollection` instances.
- Auth tokens and confirmation records are saved in the application snapshot.
- File metadata and file content are serialized in the snapshot.
- `store.reset()` clears the runtime state, recreates the demo data, and writes the snapshot again.

The snapshot file is created automatically under `back/data/state.json`.

This is persistent local state, not yet PostgreSQL or MinIO-backed storage.

## WebSocket

WebSocket endpoint: `/ws?token=<access-token>`.

Connection flow:

1. `attachWebSocketServer()` reads `token` from query params.
2. `AuthService` resolves the user by access token.
3. `WebSocketService` registers the connection and keeps a socket adapter.
4. The server sends a `connected` debug frame.
5. Client `pong` frames update `last_pong_at`.
6. `index.ts` sends periodic `ping` frames and updates `last_ping_at`.

WebSocket connection state remains runtime-only, because live sockets cannot be restored after process restart.

## Frontend

`front/` is the Vue 3 + Quasar application kept from the original project. It talks to the backend through the same API groups listed above.

## Docker

`docker-compose.yml` defines:

- `back` on port `8000`
- `front` on port `8080`
- `db`, `db-migrator`, and `file-storage` to mirror the original topology

The current TS backend does not yet bind to PostgreSQL or MinIO at runtime.

## Testing

Backend tests use Vitest:

```sh
cd back
npm test
npm run test:coverage
```

Coverage output is written to `back/coverage`.

## Remaining Gaps

The TS rewrite still does not include the original production integrations:

- PostgreSQL runtime adapter.
- MinIO runtime adapter.
- Qdrant vector search service.
- Real email sender and Telegram bot adapters.
- The full Python lifecycle/toolkit/storage hierarchy.

The current backend is functionally closer to the original because the application state is now persistent, but the storage backends are still simplified compared to the Python deployment.
