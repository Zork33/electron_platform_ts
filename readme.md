# electron_platform_ts

TypeScript rewrite of the original project in `electron_platform`.

## Structure

- `front/` - existing Vue 3 + Quasar frontend
- `back/` - new TypeScript backend implementation

## Backend

The backend entry point is `back/src/index.ts`.

Run it with:

```bash
cd back
yarn install
yarn dev
```

The server listens on `http://localhost:8000` by default.
