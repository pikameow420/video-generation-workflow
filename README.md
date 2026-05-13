# AI Video Pipeline

A **Next.js app** for solo creators: go from a topic (or your own script) to a **short vertical video** with optional **captions burned in**.

The UI is a **four-step wizard**: topic & scripts → pick or edit a script & references → character sheet → generate video, then transcribe and burn subtitles if you want.

---

## What you can do in the app


|                     |                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scripts**         | Generate **four** options via Deepseek, paste/upload your own, or pull from a **saved script library** (stored on disk / JSON index).                   |
| **Voice & brand**   | **Base prompt**, **brand kit**, and **named presets** (topic, tone, audience, notes, art direction, etc.)—presets live in the browser’s `localStorage`. |
| **Look**            | Generate a **3×3 character sheet** from the script (OpenAI image 2), optionally steer with **reference images** from your library.                      |
| **Video**           | **Seedance** reference-to-video via **Atlas Cloud** or **MuAPI** (Omni Reference No Video Fast default); async poll until the clip is ready.              |
| **Captions**        | OpenAI Whisper **transcription** or **exact script text** timed to clip length; tweak SRT and **burn** with **ffmpeg** (English, Hindi, Hinglish, or your written script).                                              |
| **Session restore** | Wizard state is **autosaved** in `localStorage` so a refresh doesn’t wipe your in-progress pipeline.                                                    |


---

## The flow (end to end)

1. **Topic** — Generate scripts or bring your own; optional presets and brand kit.
2. **Scripts** — Choose one line, edit if needed, set **art direction**, attach reference images.
3. **Sheet** — Review the generated (or uploaded) character sheet.
4. **Video** — Start generation, wait for the file, then **generate subtitles** and **burn** them into the video.

---

## Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind**, **shadcn-style UI**, **Zod** for API validation  
- **Atlas Cloud** — chat for scripts; optional Seedance reference-to-video  
- **MuAPI** — optional Seedance Omni Reference No Video Fast (`images_list` + `@image1`… slots in prompt); [playground](https://muapi.ai/playground/sd-2-omni-reference-no-video-fast); see [MuAPI SD 2](https://muapi.ai/sd-2)  
- **OpenAI** — character sheet images + transcription (when configured)  
- **ffmpeg** — caption burn-in (must be available on the machine running the burn route)

---

## Project map


| Area                             | Location                                 |
| -------------------------------- | ---------------------------------------- |
| Main wizard UI                   | `components/pipeline/PipelineWizard.tsx` |
| Step screens                     | `components/pipeline/steps/*`            |
| Script API                       | `app/api/scripts/route.ts`               |
| Character sheet API              | `app/api/character-sheet/route.ts`       |
| Video API                        | `app/api/video/route.ts`                 |
| Env & defaults                   | `lib/env.ts`                             |
| Request/response schemas         | `lib/schemas.ts`                         |
| Seedance / Atlas helpers         | `lib/seedance/client.ts`                 |
| MuAPI video helpers             | `lib/muapi/client.ts`                    |
| Creator presets (client storage) | `lib/pipeline/creator-presets.ts`        |


---

## Configuration

Copy env vars your deployment needs (see `**lib/env.ts`** for the full list and defaults). Minimally, for the full happy path:

- `**ATLASCLOUD_API_KEY**` — scripts + Atlas video path (required for those features)  
- `**MUAPI_API_KEY**` — MuAPI video path only ([authentication](https://muapi.ai/docs/authentication))  
- `**VIDEO_PROVIDER**` — default backend when the UI does not override: `atlas` or `muapi` (`lib/env.ts`)  
- `**MUAPI_BASE_URL**`, `**MUAPI_VIDEO_ENDPOINT**`, `**MUAPI_VIDEO_DURATION**` (4–15), `**MUAPI_VIDEO_ASPECT_RATIO**`, poll tuning — see `lib/env.ts`
- `**OPENAI_API_KEY**` — character sheet + transcription (optional but needed for those steps)
- `**UPLOAD_BACKEND**` — `local` (default) or `blob` for Vercel Blob reference uploads

**Reference images (local mode):** files under `public/uploads/reference-images`, index path configurable via `REFERENCE_IMAGE_INDEX_PATH`. On the Scripts step, hover a thumbnail and use the **X** to remove that image from the library (and index); **blob mode** needs `BLOB_READ_WRITE_TOKEN` for uploads and deletes.

**Captioned videos (local mode):** `LOCAL_CAPTIONED_VIDEO_DIR`, `CAPTIONED_VIDEO_BASE_PATH`, `CAPTIONED_VIDEO_INDEX_PATH`.

**Runtime:** subtitle burn-in expects `**ffmpeg`** on the host. Serverless without ffmpeg won’t be able to burn captions unless you offload that step.

---

## Run it locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Set `ATLASCLOUD_API_KEY` and `OPENAI_API_KEY` in `.env` first.

```bash
npm run lint
```

---

## Limitations

There’s **no auth** or multi-user accounts yet. **Presets** are per-browser, not synced across devices. Long **video jobs** aren’t a persisted job queue—don’t close the tab for minutes-long runs. Errors are mostly **provider messages** surfaced to the UI.

---

## Deploy

Works on **Vercel** like any Next.js app; ensure secrets match your chosen upload backend and that anything that needs **ffmpeg** runs where that binary exists (or skip burn-in in constrained runtimes).