# Agent Instructions

This is a Next.js 16 app using the App Router, React 19, shadcn-ui, TypeScript, Tailwind, Zod, Supabase Auth, and Atlas Cloud APIs.

Before editing Next.js code, check relevant docs in `node_modules/next/dist/docs/` because this version may differ from older Next.js conventions (e.g. use `proxy.ts`, not `middleware.ts`).

## Project Notes

- Pipeline step UI lives under `components/pipeline/steps/*`.
- Shared shadcn-ui primitives live under `components/ui/*`.
- Main page entry is `app/page.tsx` (requires sign-in via `proxy.ts`).
- Login UI: `app/login/page.tsx`, `components/auth/*`, callback at `app/auth/callback/route.ts`.
- Video library: `app/library/page.tsx` (user-scoped when persistence is on).
- API routes live under `app/api/*/route.ts`.
- Environment config is parsed in `lib/env.ts`.
- Request/response validation lives in `lib/schemas.ts`.
- Atlas/Seedance helpers live in `lib/seedance/client.ts`.
- MuAPI video helpers live in `lib/muapi/client.ts`.
- Auth: `lib/auth/require-user.ts` (API routes), `lib/auth/session-user.ts` (pages/proxy), `lib/auth/prediction-ownership.ts` (video job isolation).
- Route guard: `proxy.ts` + `lib/supabase/route-guard.ts` (redirect unsigned-in users from `/` and `/library`).
- When `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set, Postgres + Storage back saved scripts and uploads (`lib/persistence/backend.ts`).

## Development

- Use `npm run dev` for local development.
- Use `npm run lint` before finalizing changes.
- Use `npm test` for security-boundary tests (`tests/security-boundaries.test.ts`).
- Do not commit `.env` or secrets.
- Prefer small, scoped changes that follow existing file structure.

## API Behavior

- Server routes should return JSON errors with appropriate HTTP status codes.
- Validate request bodies with Zod schemas.
- Routes that trigger paid upstream work or read/write vault data must use `requireUser()` from `lib/auth/require-user.ts`.
- Keep provider-specific logic isolated in `lib/*` where practical.
