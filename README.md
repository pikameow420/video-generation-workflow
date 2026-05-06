# AI Social Media Video Pipeline

This is a small Next.js app for turning a creator topic into a short social video.
The intended flow is:

1. Generate four short script options.
2. Pick or edit one script.
3. Generate a 3x3 character sheet.
4. Use the character sheet as the reference image for a Seedance video.

The product is currently an early prototype. It is useful for testing the happy
path, but several "real user" pieces are intentionally not finished yet.

## Current Gaps

- No authentication or team/user ownership yet.
- Script preferences are entered per session; there is no saved base prompt.
- Generated video jobs are not persisted, so users cannot leave and resume.
- Error messages are basic and mostly surface provider failures directly.

## Implementation Notes

- Main UI: `components/PipelineWizard.tsx`
- Script generation endpoint: `app/api/scripts/route.ts`
- Character sheet endpoint: `app/api/character-sheet/route.ts`
- Video endpoint: `app/api/video/route.ts`
- Environment parsing: `lib/env.ts`
- Request validation: `lib/schemas.ts`
- Seedance helpers: `lib/seedance/client.ts`

The app uses Atlas Cloud for script, image, and video generation. The model names
and base URL can be configured in `.env`.

Reference image uploads can be configured with:

- `UPLOAD_BACKEND=local` to persist files in `public/uploads/reference-images`.
- `UPLOAD_BACKEND=blob` to persist files in Vercel Blob.
- `REFERENCE_IMAGE_INDEX_PATH` to control where upload metadata is indexed.

The upload API accepts `multipart/form-data` and currently enforces a 10MB max size
for `image/jpeg`, `image/png`, and `image/webp`.

Post-generation subtitles are configured with:

- `WHISPER_API_KEY` for transcript generation.
- `SUBTITLE_DEFAULT_LANGUAGE` and `SUBTITLE_MAX_CHARS_PER_LINE` for caption formatting.
- `LOCAL_CAPTIONED_VIDEO_DIR`, `LOCAL_CAPTIONED_VIDEO_BASE_PATH`, and `CAPTIONED_VIDEO_INDEX_PATH` for storing burned videos in local mode.

Runtime note: subtitle burn-in requires `ffmpeg` installed on the runtime host.
If your serverless target cannot run ffmpeg binaries, run burn-in in a worker/container instead.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Create a local `.env` file using `.env.example` as a starting point and set an
Atlas Cloud API key before using the generation endpoints.

## Notes for Future Work

The next product pass should make the creation flow feel more trustworthy and
ready for real users without changing the basic script-to-video journey too much.
The exact scope is intentionally open: authentication, saved prompt preferences,
uploading reference images, better recovery states, and job history are all
possible directions.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Atlas Cloud](https://www.atlascloud.ai/) - model hosting used by this prototype.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
