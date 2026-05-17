# Agent Rules

These rules apply to this repository.

- Keep root documentation shell-neutral. Do not use platform-specific code fences or commands in `README.md`.
- Use `sh` fences for cross-platform command examples unless a platform-specific section is explicitly needed.
- Prefer relative paths from the repository root in documentation.
- Keep the TypeScript backend documentation aligned with the current in-memory architecture until persistent adapters are implemented.
- Before committing backend changes, run `npm run build` and `npm test` from `back/` when the change touches runtime code.
