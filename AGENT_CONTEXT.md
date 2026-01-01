# Jivvy Agent Context

## 1. Project Overview
Jivvy is a "Calm, Local-First Workspace" modeled after Todoist’s structural efficiency and Notion’s block-based logic.
- **Core Philosophy:** "Tool First. AI Second." The interface must pass the **"Boring Test"**—no animations or styles exist just to look "cool."
- **Visual Target:** High signal, low noise. Significant whitespace, invisible controls (hover-only), and strict typography.
- **Data Ownership:** User data lives locally (IndexedDB/Dexie) and syncs via "Bring Your Own Storage" (Google Drive), not a central SaaS server.

## 2. Tech Stack (Strict)
- **Framework:** Next.js 14+ (App Router).
- **Language:** TypeScript (Strict mode, no `any`).
- **Styling:** Tailwind CSS + `clsx` + `tailwind-merge`.
- **UI Primitives:** `shadcn/ui` (Radix UI) - *No custom "gummy" components.*
- **State Management:** Zustand (`lib/store.ts`).
- **Local Database:** Dexie.js (IndexedDB) - *The Source of Truth.*
- **Sync Engine:** Google Drive API (Client-side JSON blob sync).
- **AI Engine:**
  - **Local:** Transformers.js (`@xenova/transformers`) via WebGPU.
  - **Cloud fallback:** None (external AI removed; local-first only).
- **PDF Handling:** `react-pdf` (Viewer) + `pdfjs-dist` (Extraction).

## 3. UI & Design System (The "Calm" Aesthetic)
*Do not create "Pop" or "Neo-Brutalist" elements. All UI must be minimal and utilitarian.*

- **Color Palette:**
  - **Background:** White / Zinc-50 (Light), Zinc-950 (Dark).
  - **Text:** Zinc-900 (Primary), Zinc-500 (Metadata).
  - **Accent:** **Focus Blue** (`blue-600`) for primary actions. **Alert Red** (`red-500`) for overdue items.
- **Typography:** `Geist Sans` for UI, `Geist Mono` for code/data.
  - Headers must be bold and tracking-tight.
- **Component Rules:**
  - **Invisible UI:** Action buttons (Edit, Drag, Delete) on rows/blocks **must only appear on hover**.
  - **Layout:** Use a persistent **Sidebar** (Left), a **Centered Workspace** (Main), and a **Sliding Context Panel** (Right).
  - **Borders:** Ultra-subtle (`border-zinc-100` or `dark:border-zinc-800`). No heavy outlines.

## 4. Key Architectural Patterns

### A. The "Block" Data Model
Everything in the app is a block.
- **Schema:** `{ id, parent_id, type, content, metadata, order }`
- **Types:** `text`, `task` (checkbox), `header`, `pdf_highlight` (citation).
- **Interaction:**
  - **Enter key:** Creates a new sibling block.
  - **Tab/Shift+Tab:** Indents/Outdents (modifies `parent_id`).
  - **Slash Command (`/`):** The only way to change block types or trigger AI.

### B. "Battery-Safe" AI (Deferred Intelligence)
- **Rule:** Never run heavy AI (embeddings/vectorization) while the user is typing on battery power.
- **Queue System:**
  - User edits are saved to Dexie immediately (Text).
  - AI tasks are pushed to a `JobQueue` table.
- **The "Burst" Governor:**
  - The `QueueWorker` only processes jobs when:
    1. The device is **Plugged In**.
    2. The user explicitly clicks "Study Mode".
    3. Or user enters "Performance Mode" manually.

### C. "Bring Your Own Storage" Sync
- **No Backend DB:** Do not use Supabase for data persistence.
- **Mechanism:**
  - Serialize Dexie state (Blocks/Projects) into `jivvy_state.json`.
  - Upload to user's Google Drive `appDataFolder`.
  - **Exclude:** Do not sync large Vectors/Embeddings. Regenerate them locally on the destination device.

## 5. Coding & Validation Standards
*The agent must follow these steps before confirming a task is complete.*

1. **The "Boring Test":** If you added a feature, ask: "Does this require a tutorial?" If yes, simplify it.
2. **Type Safety:** Ensure all `Block` interactions use the strict TypeScript interfaces in `@/types/block.ts`.
3. **Performance:**
   - Use `React.memo` for list items (Block rows) to prevent re-rendering the whole doc on every keystroke.
   - Use `Uncontrolled Inputs` (Refs) for the text editor where possible.
4. **Directory Integrity:**
   - `/components/editor` -> Block logic.
   - `/components/pdf` -> Context panel logic.
   - `/workers` -> AI and Sync background threads.

## 6. Critical Features Checklist
- [ ] **Mouse-First keyboard second:** Ensure every block has a "Six-Dot" drag handle.
- [ ] **Context Panel:** Clicking a citation block MUST open the Right Panel, not navigate away.
- [ ] **Semantic Distractors:** AI MCQ generation must produce "plausible lies," not random answers.

## 7. Infrastructure & Cost Optimization
*Strategy: Free Tier Maximization. Use Vercel and Supabase only for what they do best for free.*

### A. Vercel (Hosting & Edge)
- **Role:** Frontend hosting and API Routes.
- **Cost Saving Rule:**
  - **Avoid Heavy Compute:** Do not run long-running AI tasks on Vercel Serverless Functions (10s timeout on free tier).
  - **Offload to Client:** All "heavy lifting" (vectorization, file parsing) happens in the user's browser via Web Workers, not Vercel servers.
  - **Cache Aggressively:** Use `next/image` and Vercel's Edge Caching for static assets to reduce bandwidth usage.

### B. Supabase (Auth & Realtime)
- **Role:** Authentication (Google OAuth) and minimal signaling (if needed).
- **Cost Saving Rule:**
  - **Auth Only:** Use Supabase primarily for the "Sign In with Google" flow.
  - **No Database Storage:** **Do NOT** use Supabase Postgres for storing user notes or PDF files. This avoids row limits and storage costs.
  - **No Storage Buckets:** **Do NOT** use Supabase Storage for files. Use Google Drive (User's Storage) instead.
  - **Realtime:** Only use Supabase Realtime for lightweight signaling (e.g., "User X is typing") if collaboration is added later.