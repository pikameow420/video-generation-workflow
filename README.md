# AI Social

Generate short-form vertical videos in minutes using AI.

AI Social is a Next.js application built for solo creators, marketers, and growth teams who want to turn ideas into ready-to-publish videos without juggling multiple tools. Generate scripts, create consistent AI characters, build scene layouts, and render complete videos from a single workflow.

---

## ✨ What You Can Do

### AI Script Generation

Generate multiple script variations from a topic, brand brief, or style guide.

* Generate 4 AI-powered script options
* Bring your own script
* Upload source material
* Save and reuse scripts
* Maintain brand voice consistency

### Character Management

Create reusable AI characters for your content.

* Save character profiles
* Upload reference images
* Configure art direction
* Customize voice settings
* Reuse characters across videos

### Video Planning

Review and refine your video before generation.

* Visual 3×3 scene grid
* Edit individual frames
* Reuse previous video sheets
* Maintain consistent storytelling

### Video Generation

Turn approved video sheets into rendered vertical videos.

* Multiple video providers
* AI-generated scenes
* Automatic transcription
* Burned-in captions
* Export-ready assets

### Content Library

Keep your content organized.

* Saved scripts
* Character profiles
* Generated videos
* Historical projects

---

## 🚀 Workflow

1. **Topic**

   * Enter a content idea or upload your own script

2. **Script Selection**

   * Generate multiple script options
   * Edit and refine your preferred version

3. **Character Setup**

   * Choose an existing character
   * Or create a new one with custom references

4. **Video Sheet**

   * Review scene layouts
   * Adjust visual direction

5. **Generate Video**

   * Render the final video
   * Add captions if desired

---

## 🏗️ Tech Stack

* Next.js
* React
* TypeScript
* Supabase
* OpenAI
* AtlasCloud
* FFmpeg

---

## Local Development

### Requirements

* Node.js 20+
* npm
* FFmpeg

### Installation

```bash
git clone <repository-url>
cd ai-social-media

npm install
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

ATLASCLOUD_API_KEY=
OPENAI_API_KEY=
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Run checks:

```bash
npm run lint
npm test
```

---

## Environment Variables

| Variable                             | Required | Description                                   |
| ------------------------------------ | -------- | --------------------------------------------- |
| NEXT_PUBLIC_SUPABASE_URL             | Yes      | Supabase project URL                          |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Yes      | Client-side Supabase authentication           |
| SUPABASE_SECRET_KEY                  | Yes*     | Database access, storage, migrations          |
| ATLASCLOUD_API_KEY                   | Yes*     | Script generation and video rendering         |
| OPENAI_API_KEY                       | Yes*     | Character generation, planning, transcription |
| VIDEO_PROVIDER                       | No       | `atlas` or `muapi`                            |
| MUAPI_API_KEY                        | No       | Required only when using MuAPI                |

* Required for full generation and export functionality.

---

## Storage Modes

### Supabase Mode

Recommended for production deployments.

Features:

* Persistent scripts
* Character profiles
* Video metadata
* Shared storage
* PostgreSQL backend

Apply the migrations found in:

```text
supabase/migrations/
```

### Local Mode

Works without Supabase.

Data is stored locally using:

```text
data/
public/uploads/
localStorage
```

Suitable for local development and testing.

---

## Known Limitations

* Wizard state is browser-specific
* Local mode does not sync across devices
* Long-running video jobs require the browser tab to remain open
* Background processing is not yet supported

---

## License

MIT License
