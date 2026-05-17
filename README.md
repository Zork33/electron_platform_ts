# electron_platform_ts

TypeScript rewrite of the original `electron_platform` project.

Python upstream: https://github.com/cheburatino/electron_platform

The project contains a Vue 3 + Quasar frontend and a TypeScript backend built with Express, `ws`, and Vitest. The backend preserves the main API contracts used by the frontend and persists runtime state to `back/data/state.json`.

## Layout

```text
electron_platform_ts/
  back/                 TypeScript backend
  front/                Vue 3 + Quasar frontend
  docs/                 architecture and project documentation
  docker-compose.yml    local container startup
```

## Backend

Backend source lives in `back/src`.

Main files:

- `app.ts` - Express app factory and WebSocket attach logic.
- `index.ts` - HTTP/WebSocket server startup.
- `routes.ts` - HTTP route definitions.
- `store.ts` - composition root for persistent collections and services.
- `types.ts` - shared backend DTO/domain types.

Service modules:

- `auth-service.ts`
- `auth-api-service.ts`
- `profile-service.ts`
- `crud-api-service.ts`
- `file-storage.ts`
- `file-api-service.ts`
- `event-service.ts`
- `object-container.ts`
- `ws-service.ts`
- `record-collection.ts`

See [architecture.md](docs/architecture.md) for the full architecture description.

## Run Locally

Backend:

```sh
cd back
npm install
npm run dev
```

The backend listens on `http://localhost:8000` by default.

Frontend:

```sh
cd front
yarn install
yarn dev
```

## Docker

```sh
docker compose up --build
```

The compose file mirrors the original service topology with PostgreSQL, migrator, and MinIO containers. The TS backend currently keeps its own persistent state file under `back/data/` and does not yet bind to those services at runtime.

Default ports:

- backend: `8000`
- frontend: `8080`

## Backend Scripts

Run from `back/`:

```sh
npm run build
npm test
npm run test:coverage
```

## API Groups

- `/user-api/auth/*`
- `/user-api/user/*`
- `/user-api/person/*`
- `/user-api/contact-info/*`
- `/user-api/phone-number/*`
- `/user-api/email/*`
- `/user-api/tg-acc/*`
- `/user-api/web-link/*`
- `/user-api/event/*`
- `/user-api/file-storage/*`
- `/user-api/file-manager/*`
- `/dev-api/*`
- `/health`
- `/ws?token=<access-token>`

## Current State

This is a TypeScript migration with persistent local state, not yet a production backend wired to PostgreSQL, MinIO or Qdrant.

Implemented:

- Express HTTP backend.
- WebSocket endpoint and debug send routes.
- Auth confirmation flow, access token refresh, logout and logout-all.
- Users, persons, contact data, events and report gallery.
- File storage and file manager contracts with persisted file metadata and content.
- Object-container storage summary.
- Persistent local state snapshot under `back/data/state.json`.
- Vitest test suite with coverage.

Still ephemeral at runtime:

- WebSocket connection state.

Not ported as production infrastructure yet:

- PostgreSQL runtime persistence.
- MinIO.
- Qdrant.
- Telegram/email adapters.
- Full Python lifecycle/toolkit/storage architecture.

## Startup And Testing Steps

1. Install backend dependencies:

```sh
cd back
npm install
```

2. Run backend in development mode:

```sh
npm run dev
```

3. In a separate terminal, install frontend dependencies:

```sh
cd front
yarn install
```

4. Run frontend in development mode:

```sh
yarn dev
```

5. Open the services:

```text
backend:  http://localhost:8000
frontend: http://localhost:8080
health:   http://localhost:8000/health
```

6. Build and test backend:

```sh
cd back
npm run build
npm test
npm run test:coverage
```

7. Optional Docker startup from the project root:

```sh
docker compose up --build
```
