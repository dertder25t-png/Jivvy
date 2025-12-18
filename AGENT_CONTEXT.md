# Jivvy Agent Context

## 1. Project Overview
Jivvy is a **PWA-enabled Local-First** Neo-Brutalist knowledge engine and study tool. It uses a "soft pop" aesthetic with gummy buttons and tilt cards.
- **Core Philosophy:** User data (PDFs, Vectors) lives on the device (IndexedDB/Dexie), not the server.
- **Syncing:** Only lightweight metadata (project titles, file hashes) syncs to Supabase.
- **PWA:** App works offline and can be installed on desktop/mobile.

## 2. Tech Stack (Strict)
- **Framework:** Next.js 14 (App Router) + next-pwa
- **Language:** TypeScript (Strict mode, no `any`)
- **Styling:** Tailwind CSS + `clsx` + `tailwind-merge`
- **State Management:** Zustand (`lib/store.ts`)
- **Database/Auth:** Supabase (`utils/supabase/`)
- **Local Database:** Dexie.js (`lib/db.ts`) for IndexedDB
- **AI Engine:**
  - Cloud: Google Gemini (`@google/generative-ai`)
  - Local: Transformers.js (`@xenova/transformers`) running in browser.
- **PDF Handling:** `react-pdf` for viewing, `pdfjs-dist` for extraction.

## 3. UI & Design System (Neo-Brutalist)
*Do not create standard HTML buttons. Use the custom components found in `components/ui/`.*

- **Buttons:** Use `<GummyButton />` for primary actions.
  - *Path:* `components/ui/GummyButton.tsx`
- **Cards:** Use `<TiltCard />` for containers.
  - *Path:* `components/ui/TiltCard.tsx`
- **Device Sync:** Use `<DeviceSyncBanner />` when local files are missing.
  - *Path:* `components/ui/DeviceSyncBanner.tsx`
- **Icons:** Use `lucide-react` (e.g., `<Settings className="w-4 h-4" />`).
- **Colors:** Primary accent is `lime-400`. Background is dark mode default.
- **Fonts:** Geist Sans (Variable) and Geist Mono.

## 4. Key Architectural Patterns

### A. The "Local-First" Rule
- **Never** upload PDF files to Supabase Storage.
- **Always** store large blobs (PDFs) and vectors in the local Dexie DB (`lib/db.ts`).
- **Lazy Loading:** Do not load the Vector Store or PDF Blob until the specific component requests it.

### B. Worker-Only Vector Computation
- **Never** compute embeddings on the main thread.
- **Always** send text chunks to `workers/miner.worker.ts` with `GENERATE_EMBEDDINGS` command.
- Worker saves vectors directly to Dexie, then posts completion message.

### C. Device-Switch File Handling
- When user switches devices, local files are NOT available.
- Use `DeviceSyncBanner` to prompt re-upload.
- Store SHA-256 hash in Supabase `file_hash` column for verification.
- If uploaded file hash doesn't match, warn user: "This file appears different."

### D. Server Actions
- All database mutations live in `app/**/actions.ts`.
- Use `"use server"` at the top of action files.
- Always validate user auth using `createClient()` before mutating data.

## 5. Validation & Testing Rules
*The agent must follow these steps before confirming a task is complete.*

1.  **Linting:** Run `npm run lint` to catch syntax errors.
2.  **Type Check:** Run `tsc --noEmit` to ensure type safety.
3.  **End-to-End:** If you created a UI element, you MUST create/run a Playwright test in `tests/` to verify it is clickable and visible.
4.  **No Broken Imports:** Verify all imports use the `@/` alias (e.g., `import { store } from "@/lib/store"`).

## 6. Directory Structure Map
- `/app` -> Next.js App Router pages and API routes.
- `/components/ui` -> Reusable design system elements (Buttons, Cards).
- `/components/workspace` -> Complex features (PDF Viewer, Canvas, Notebook).
- `/lib` -> Utility functions, Zustand stores, Dexie DB (`db.ts`).
- `/utils` -> External service clients (Supabase, OpenAI, PDF logic).
- `/workers` -> Web Workers for heavy background tasks (Mining, Embeddings).
- `/public` -> Static assets and PWA manifest.
