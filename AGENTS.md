# Agent Instructions

This is a Next.js 16 app using the App Router, React 19, TypeScript, Tailwind, Zod, and Atlas Cloud APIs.

Before editing Next.js code, check relevant docs in `node_modules/next/dist/docs/` because this version may differ from older Next.js conventions.

## Project Notes

- Main UI lives in `components/PipelineWizard.tsx`.
- Main page entry is `app/page.tsx`.
- API routes live under `app/api/*/route.ts`.
- Environment config is parsed in `lib/env.ts`.
- Request/response validation lives in `lib/schemas.ts`.
- Atlas/Seedance helpers live in `lib/seedance/client.ts`.

## Development

- Use `npm run dev` for local development.
- Use `npm run lint` before finalizing changes.
- Do not commit `.env` or secrets.
- Prefer small, scoped changes that follow existing file structure.

## API Behavior

- Server routes should return JSON errors with appropriate HTTP status codes.
- Validate request bodies with Zod schemas.
- Keep provider-specific logic isolated in `lib/*` where practical.