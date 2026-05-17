# electron_platform_ts

TypeScript rewrite of the original `electron_platform` project.

The project contains a Vue 3 + Quasar frontend and a TypeScript backend built with Express, `ws`, and Vitest. The backend currently preserves the main API contracts used by the frontend, while persistence and infrastructure are implemented in memory.

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
- `store.ts` - composition root for in-memory collections and services.
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

```powershell
cd back
npm install
npm run dev
```

The backend listens on `http://localhost:8000` by default.

Frontend:

```powershell
cd front
yarn install
yarn dev
```

## Docker

```powershell
docker compose up --build
```

Default ports:

- backend: `8000`
- frontend: `8080`

## Backend Scripts

Run from `back/`:

```powershell
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

This is a TypeScript migration, not a production persistence rewrite yet.

Implemented:

- Express HTTP backend.
- WebSocket endpoint and debug send routes.
- Auth confirmation flow, access token refresh, logout and logout-all.
- Users, persons, contact data, events and report gallery.
- File storage and file manager contracts.
- Object-container storage summary.
- Vitest test suite with coverage.

Still in memory:

- Records.
- Stored files.
- Auth tokens and confirmation codes.
- WebSocket connection state.

Not ported as production infrastructure yet:

- PostgreSQL runtime persistence.
- MinIO.
- Qdrant.
- Telegram/email adapters.
- Full Python lifecycle/toolkit/storage architecture.
