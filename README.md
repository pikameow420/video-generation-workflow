# AI Video Pipeline

A **Next.js app** for solo creators: go from a topic (or your own script) to a **short vertical video** with optional **captions burned in**.

The UI is a **five-step wizard**: topic & scripts → pick or edit a script → character profile & references → frame sequence sheet → generate video, then transcribe and burn subtitles if you want. **Sign-in is required** to use the pipeline, library, and paid API routes.

---

## What you can do in the app

| | |
| --- | --- |
| **Sign-in** | **Supabase Auth** (email/password at `/login`). Sessions are cookie-based; `/` and `/library` redirect when unsigned-in. |
| **Scripts** | Generate **four** options via Deepseek, paste/upload your own, or pull from a **saved script library** (local JSON index *or* **Supabase Postgres** when persistence is configured). |
| **Voice & brand** | **Base prompt**, **brand kit**, and **named presets** (topic, tone, audience, notes, art direction, etc.)—presets live in the browser’s `localStorage`. |
| **Character profiles** | Save a reusable **Character Profile** (name, art direction, anchor reference photos, optional MP3/WAV voice sample, last frame-sequence-sheet). Select it on the new **Character** step to pre-fill refs/voice instead of re-uploading every run. Persisted per user in Supabase (or a local JSON index). One-off runs without a profile still work. |
| **Look** | Generate a **3×3 frame-sequence-sheet** from the script (OpenAI `gpt-image-1.5` default)—the frame sequence handed to Seedance/MuAPI—optionally steered by **reference images** from your library or profile. Reuse a profile’s saved sheet to skip regeneration. |
| **Video** | **Seedance** reference-to-video via **Atlas Cloud** or **MuAPI** (Omni Reference No Video Fast default); async poll until the clip is ready. |
| **Library** | **`/library`** lists pipeline MP4s stored when Supabase persistence is enabled (scoped to the signed-in user). |
| **Captions** | OpenAI Whisper **transcription** or **exact script text** timed to clip length; tweak SRT and **burn** with **ffmpeg** (English, Hindi, Hinglish, or your written script). |
| **Session restore** | Wizard state is **autosaved** in `localStorage` so a refresh doesn’t wipe your in-progress pipeline. |

---

## The flow (end to end)

1. **Sign in** at `/login` (or get redirected there from `/`).
2. **Topic** — Generate scripts or bring your own; optional presets and brand kit.
3. **Scripts** — Choose one line and edit it if needed.
4. **Character** — Pick an existing **Character Profile** (refs, art direction, voice pre-filled) or set them up ad-hoc; optionally save the selection as a new profile.
5. **Sheet** — Review the generated (or reused) frame sequence sheet.
6. **Video** — Start generation, wait for the file, then **generate subtitles** and **burn** them into the video.

---

## Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind**, **shadcn-style UI**, **Zod** for API validation
- **Supabase Auth** — sign-in, sessions, optional Postgres + Storage persistence
- **Atlas Cloud** — chat for scripts; optional Seedance reference-to-video
- **MuAPI** — optional Seedance Omni Reference No Video Fast (`images_list` + `@image1`… slots in prompt); [playground](https://muapi.ai/playground/sd-2-omni-reference-no-video-fast); see [MuAPI SD 2](https://muapi.ai/sd-2)
- **OpenAI** — character sheet images + transcription (when configured)
- **ffmpeg** — caption burn-in (must be available on the machine running the burn route)

---

## Project map

| Area | Location |
| --- | --- |
| Main wizard UI | `components/pipeline/PipelineWizard.tsx` |
| Step screens | `components/pipeline/steps/*` |
| Login UI | `app/login/page.tsx`, `components/auth/LoginForm.tsx` |
| Auth callback | `app/auth/callback/route.ts` |
| Video library page | `app/library/page.tsx` |
| Route guard (session + redirects) | `proxy.ts`, `lib/supabase/route-guard.ts` |
| Auth helpers | `lib/auth/require-user.ts`, `lib/auth/session-user.ts`, `lib/auth/prediction-ownership.ts` |
| Script API | `app/api/scripts/route.ts` |
| Frame sequence sheet API | `app/api/frame-sequence-sheet/route.ts` |
| Character profiles API | `app/api/character-profiles/route.ts`, `app/api/character-profiles/[id]/sheet/route.ts` |
| Character profiles store | `lib/character-profiles/store.ts` |
| Video API | `app/api/video/route.ts` |
| Env & defaults | `lib/env.ts` |
| Request/response schemas | `lib/schemas.ts` |
| Seedance / Atlas helpers | `lib/seedance/client.ts` |
| MuAPI video helpers | `lib/muapi/client.ts` |
| Persistence toggle | `lib/persistence/backend.ts` |
| Creator presets (client storage) | `lib/pipeline/creator-presets.ts` |
| Tests | `tests/security-boundaries.test.ts`, `tests/character-profiles-store.test.ts` |

---

## Configuration

Copy env vars your deployment needs (see `lib/env.ts` for defaults and the full schema).

### Supabase Auth (required)

The app expects Supabase for sign-in and session cookies:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Create users in the [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **Users**, or use **Sign up** on `/login`.

Paid and vault API routes call `requireUser()` and return **401** without a valid session—even when Postgres persistence is off.

### Providers (for the full pipeline)

- `ATLASCLOUD_API_KEY` — scripts + Atlas video path (required for those features)
- `MUAPI_API_KEY` — MuAPI video path only ([authentication](https://muapi.ai/docs/authentication))
- `VIDEO_PROVIDER` — default backend when the UI does not override: `atlas` or `muapi` (`lib/env.ts`)
- `MUAPI_BASE_URL`, `MUAPI_VIDEO_ENDPOINT`, `MUAPI_VIDEO_DURATION` (4–15), `MUAPI_VIDEO_ASPECT_RATIO`, poll tuning — see `lib/env.ts`
- `OPENAI_API_KEY` — profile character sheets (GPT Image 2 via edits), frame sequence sheet, transcription
- `OPENAI_CHARACTER_SHEET_MODEL` (default `gpt-image-2`), `OPENAI_CHARACTER_SHEET_SIZE` (default `1080x1920`) — profile character sheets; frame sheet uses `OPENAI_IMAGE_MODEL` / `OPENAI_IMAGE_SIZE`
- `UPLOAD_BACKEND` — `local` (default) or `blob`; affects reference images **only when Supabase persistence is not configured** (`blob` uses Vercel Blob)

### Supabase persistence (optional)

When **`NEXT_PUBLIC_SUPABASE_URL`** and **`SUPABASE_SECRET_KEY`** (service role, server-only) are both set, saved scripts, reference images, character profiles, and pipeline MP4s go to Postgres + **private** Storage buckets. Vault rows are scoped by `user_id`.

Optional bucket/tuning vars: `SUPABASE_REFERENCE_IMAGES_BUCKET`, `SUPABASE_PIPELINE_VIDEOS_BUCKET`, `SUPABASE_CHARACTER_ASSETS_BUCKET`, `SUPABASE_SIGNED_URL_EXPIRES_SEC`.

Apply migrations in [`supabase/migrations/`](supabase/migrations/):

- `20250517120000_initial_persistence.sql` — core tables + storage buckets
- `20250518120000_add_pipeline_videos_columns.sql` — `title`, `is_deleted`
- `20250518130000_add_prediction_tracking.sql` — in-progress video job ownership
- `20250524120000_character_profiles.sql` — `character_profiles` table + `character-assets` bucket
- `20250526120000_character_profile_muapi_sheet.sql` — character reference sheet columns on `character_profiles` (`muapi_character_*`)

**Character profiles (local fallback when persistence off):** profile metadata in `CHARACTER_PROFILE_INDEX_PATH` (default `data/character-profiles.json`); voice samples and saved sheets under `LOCAL_CHARACTER_ASSET_DIR` (default `public/uploads/character-assets`).

**Reference images (local fallbacks when persistence off):** files under `public/uploads/reference-images`, index path configurable via `REFERENCE_IMAGE_INDEX_PATH`. On the Scripts step, hover a thumbnail and use the **X** to remove that image from the library (and index); **blob mode** needs `BLOB_READ_WRITE_TOKEN` for uploads and deletes.

**Captioned videos (fallback when Supabase off):** `LOCAL_CAPTIONED_VIDEO_DIR`, `CAPTIONED_VIDEO_BASE_PATH`, `CAPTIONED_VIDEO_INDEX_PATH`.

**Runtime:** subtitle burn-in expects `ffmpeg` on the host. Serverless without ffmpeg won’t be able to burn captions unless you offload that step.

---

## Run it locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Minimum `.env` for auth + a typical run:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (needed for vault persistence and server-side Supabase writes)
- `ATLASCLOUD_API_KEY`
- `OPENAI_API_KEY`

```bash
npm run lint
npm test
```

---

## Limitations

**Presets** and in-progress wizard state are per-browser (`localStorage`), not synced across devices. Long **video jobs** aren’t a persisted job queue—don’t close the tab for minutes-long runs. Errors are mostly **provider messages** surfaced to the UI. There is no org/team model beyond per-user vault isolation when Supabase persistence is on.

---

## Deploy

Works on **Vercel** like any Next.js app. Set Supabase and provider secrets in the deployment environment. Add your production URL (e.g. `https://your-app.example/auth/callback`) to Supabase **Authentication** → **URL Configuration** → **Redirect URLs**. Ensure secrets match your chosen upload backend and that anything needing **ffmpeg** runs where that binary exists (or skip burn-in in constrained runtimes).
