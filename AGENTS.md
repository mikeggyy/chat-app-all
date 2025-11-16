# Repository Guidelines

## Project Structure & Module Organization
- `chat-app/` bundles the consumer Express backend (`backend/src/*`) and the Vue frontend (`frontend/src/*`).
- `chat-app-admin/` mirrors that split for moderation dashboards, keeping routes in `backend/src/routes/`.
- `shared/` stores guards, config seeds, and utilities reused by both apps, while repo `scripts/` plus `start-all.js` automate port cleanup, Firebase imports, and config checks documented in `docs/`.

## Build, Test, and Development Commands
- `npm run install:all` installs every package once.
- `npm run dev` frees ports, then starts both backends and both frontends; scope work with `npm run dev:app-backend` or `dev:admin-frontend`.
- Build with `npm run build:backend` and `npm run build:frontend`; `chat-app/frontend` also provides `npm run optimize-images` for heavy assets.
- Backends expose `npm run import:*`, `npm run init:*`, and `npm run verify-config`; log any data seeds you run and finish with `npm run kill-all-node`.

## Coding Style & Naming Conventions
- Use ESM, 2-space indentation, and feature folders; HTTP entry points end in `*.routes.js` and call `*.service.js`.
- Vue files stay in PascalCase, composables follow `useThing.ts`, and Pinia stores live under `src/stores/`; order imports packages → shared modules → relatives.
- Prefer `async/await`, validate payloads with `zod`, and centralize shared constants in `shared/config/` or `chat-app/config/`.

## Testing Guidelines
- Vitest is standard: `npm run test`, `npm run test:run`, `npm run test:coverage`, and `npm run test:ui` cover watch, CI, coverage, and UI modes.
- `chat-app/frontend` adds `npm run type-check`, and the chat backend supplies scenario scripts (`npm run test:env`, `test:membership`, `test:favorites`, etc.); execute the relevant ones and reference them in the PR.
- Keep specs beside their features (`src/__tests__/` server-side, component folders client-side) and continue the `*.spec.ts` / `*.spec.js` naming.

## Commit & Pull Request Guidelines
- Commits stay short, scope-first, and imperative, consistent with history lines like `聊天` or `ts`.
- PRs summarize the problem, solution, and commands run, link tracking issues, attach screenshots for UI tweaks, and mention any scripts reviewers must run.
- Highlight changes in `shared/` or `chat-app/config/` so both the consumer and admin apps receive regression testing.

## Environment & Configuration Tips
- `.env` files live beside each backend; copy the samples, keep secrets out of git, and validate with `npm run test:env`.
- Use `npm run dev:firebase` or `npm run dev:with-emulator` to wire Firebase emulators into the consumer stack.
- Cloudflare Pages deploys read `chat-app/wrangler.toml`; provide the branch when calling `npm run deploy:pages` or `npm run deploy:pages:preview`.
