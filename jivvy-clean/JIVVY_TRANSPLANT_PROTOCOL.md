# 🚀 Project Jivvy: The "Clean Transplant" Master Protocol (Convex Edition)

**Objective:** Create a Production-Ready Beta of "Jivvy" in < 5 days.
**Strategy:** "Component Transplant" + "Vibe Backend". We graft the high-quality UI onto a Convex backend for instant speed and easy syncing.
**Source Codebase:** `v2-implementation` (UI Source).
**Tech Stack:** Next.js 14, **Convex** (Realtime DB & Backend), Google Drive (Optional "Protection" Backup), Transformers.js (Local AI).
Make sure to read AGENT_CONTEXT.MD

---

## 🛑 PHASE 0: MISSION INITIALIZATION [DONE]
**Agent Instructions:** Perform these steps strictly in order. Do not skip.

1.  **Context Preservation (CRITICAL):** [DONE]
    * Create a file named `JIVVY_TRANSPLANT_PROTOCOL.md` in the root of your new workspace.
    * **Copy the content of this entire document** into that file.
    * *Why:* You will need to check off phases as you complete them.

2.  **Environment Setup:** [DONE]
    * Initialize: `npx create-next-app@latest jivvy-clean --typescript --tailwind --eslint`
    * *Settings:* Yes to App Router, No to `src/` directory, Yes to `@/*` alias.
    * Install Core Logic: `npm install convex @supabase/supabase-js @supabase/ssr dexie zustand clsx tailwind-merge lucide-react uuid`
    * Install UI Deps: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
    * Install Editor: `npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder`

3.  **Transplant Global Styles (The "Vibe"):** [DONE]
    * **Source:** `v2-implementation/app/globals.css` -> **Dest:** `jivvy-clean/app/globals.css`
    * **Source:** `v2-implementation/tailwind.config.ts` -> **Dest:** `jivvy-clean/tailwind.config.ts`
    * **Source:** `v2-implementation/lib/utils.ts` -> **Dest:** `jivvy-clean/lib/utils.ts`

### 🗑️ Cleanup Checklist (Phase 0)
- [x] Initial boilerplate (`src/`, `public/next.svg`, `public/vercel.svg`) - *Cleaned on init*

---

## 🧠 PHASE 1: THE BRAIN (Convex Rewrite) [TODO]
**Agent Instructions:** We are pivoting from Dexie/Supabase to Convex for simpler state management.

### 1.1 Initialize Convex
* **Action:** Run `npm install convex` and `npx convex dev`.
* **Log in:** Follow the browser prompts.
* **Result:** A `convex/` folder is created in your root.

### 1.2 The "Vibe" Schema (`convex/schema.ts`)
* **Goal:** Define our data structure in TypeScript.
* **Action:** Create `convex/schema.ts` with these tables:
    * `projects`: `title`, `isArchived`, `userId`.
    * `blocks`: `parentId`, `type` (text, task, image, lecture), `content`, `order` (float for easy reordering), `isComplete`.
    * `lectures`: `title`, `transcript` (long text), `summary`, `audioUrl` (external link), `source` (e.g., 'voicenotes_import'), `userId`.
    * `users`: `email`, `storagePreference` ('convex-only' | 'google-backup'), `activeLectureId` (v.optional(v.id("projects"))).
    * *Note:* `activeLectureId` is the "Session Switch". It tells the backend where to route incoming Webhooks.

### 1.3 The API Layer (`convex/notes.ts`)
* **Goal:** Replace Redux/Zustand async thunks with simple Mutations.
* **Create Functions:**
    * `getProject(id)`: Query `blocks` where `parentId === id`, sorted by `order`.
    * `createBlock(parentId, type, order)`: Insert new document.
    * `updateBlock(id, changes)`: Patch document.
    * `setActiveLecture(projectId)`: Updates `users.activeLectureId`.
        * *Logic:* If sending the SAME projectId, toggle it OFF (end session). If different, switch TO it.

### 1.4 Connect to Store (`lib/store.ts`)
* **Refactor:** Update `useStore` to remove `db.ts` (Dexie) calls.
* **Logic:** The Store now purely handles **UI State** (Sidebar open/close, current view). Data fetching is handled directly in components via `useQuery(api.notes.getProject)`.

### 🗑️ Cleanup Checklist (Phase 1)
The following components from the "Old System" are now **OBSOLETE** and replaced by Convex:
- [ ] `lib/db.ts` (Dexie)
- [ ] `lib/sync/snapshot.ts` (Old manual sync)

---

## 🦴 PHASE 2: THE BODY (UI Transplant) [DONE]
**Agent Instructions:** Copy these components from `v2-implementation`. They are safe.

1.  **Base Components:**
    * Copy folder `components/ui/` -> `jivvy-clean/components/ui/`.
    * *Verify:* `GummyButton.tsx` and `TiltCard.tsx` are present.

2.  **The Editor (Notion-Style):**
    * Copy folder `components/editor/` -> `jivvy-clean/components/editor/`.
    * **Refactor:** Open `BlockList.tsx`. Replace the old `useLiveQuery` with your new `useStore`/Convex hooks.

3.  **The Dashboard (Todoist-Style):**
    * Copy `components/layout/Sidebar.tsx`.
    * Create `app/dashboard/page.tsx` that replicates the layout.

4.  **The Pro Writing Engine (Academic Tools):**
    * **Source Drawer:** Copy `components/workspace/SourceDrawer.tsx` -> `jivvy-clean/components/workspace/SourceDrawer.tsx`.
    * **Citation Logic:** Copy `utils/citation-formatter.ts` -> `jivvy-clean/lib/citation-formatter.ts`.
    * **Paper View:** Copy `components/views/DocView.tsx`.
    * **Page Breaks:** Copy `components/editor/blocks/PageBreakBlock.tsx`.
    * **Refactor:** Ensure `SourceDrawer` uses `useStore` or Convex queries directly.

### 🗑️ Cleanup Checklist (Phase 2)
- [ ] `components/editor/BlockList.tsx` (Refactored to use Convex)

---

## ⚡ PHASE 3: THE AUTOMATION (Patterns) [DONE]
**Agent Instructions:** Keep the "Pattern Engine" local for speed, but store results in Convex.

1.  **The Context Sidebar:**
    * Create `components/workspace/RightSidebar.tsx`.

2.  **The "Pattern" Worker (`workers/pattern-engine.worker.ts`):**
    * **Logic:** Run on every keystroke (debounced 300ms).
    * **Action:** When a user accepts a flashcard suggestion, call `convex.mutation(api.flashcards.create, { front, back })`.

---

## 🎓 PHASE 4: THE LECTURE HALL (New Feature) [TODO]
**Agent Instructions:** Build the "Smart Routing" import system using the existing blocks.

### 4.1 The "Live Session" Addon Button
* **Target:** `components/editor/blocks/LectureContainerBlock.tsx` (or Project Header).
* **UI:** Add a simple button/badge: "🔴 Start Live Lecture".
* **Action:**
    * On Click: Calls `api.notes.setActiveLecture(projectId)`.
    * **Visual:** When active, show a pulsing badge: "Listening for Notes... (Press Alt+N)".

### 4.2 The Smart Webhook (`convex/http.ts`)
* **Goal:** Route incoming VoiceNotes to the *active* project automatically.
* **Action:** Create `POST /webhook/voicenotes` endpoint.
* **Logic Flow:**
    1.  **Receive:** JSON `{ transcript, audioUrl, title }`.
    2.  **Lookup:** Find user by API key/email.
    3.  **Context Check:** Check `user.activeLectureId`.
        * **If Active:** Create the Lecture Block *inside* that project ID.
        * **If Idle:** Create it in the "Inbox".

### 4.3 The Lecture Block Display
* **Refactor:** Update `LectureContainerBlock.tsx` to read from the `lectures` table.
* **Features:** Display the transcript and the external `audioUrl` (DO NOT upload MP3 to Convex).

---

## 📝 PHASE 5: Task Engine & UI Polish [DONE]
**Goal**: Implement Todoist-style Inbox and Tasks.
- [x] Font Fix (`globals.css`)
- [x] TaskListView
- [x] TaskBlock Visuals

**Agent Instructions:** Identity only. No data storage.

1.  **The Wrapper (`components/providers/AuthProvider.tsx`):**
    * Check `supabase.auth.getUser()`.
    * **Purpose:** Only used to get a consistent User ID.

---

## 🛡️ PHASE 6: THE PROTECTION SYSTEM (Storage Strategy) [TODO]
**Agent Instructions:** Implement the "Google Drive Backup" switch.

### 6.1 The "Switch" Settings
* **Schema Update:** Ensure `users` table has `storagePreference`.
* **UI:** Create `components/dashboard/StorageSwitch.tsx`.
    * Option A: "Jivvy Cloud" (Fast, Default).
    * Option B: "Google Drive Backup" (Slower, Private).

### 6.2 The Backup Agent (Convex Action)
* **File:** `convex/backup.ts`
* **Action:** `backupToDrive` (runs on a cron schedule or manual trigger).
    * Fetch all user notes.
    * Convert to JSON/Markdown.
    * Use Google Drive API (via `googleapis`) to overwrite `jivvy_backup.json` in the user's Drive.

---

## 🏁 PHASE 7: FINAL VERIFICATION
**Agent Instructions:** Perform these checks before finishing.

1.  **The "Vibe" Check:** Type in a block. Open a second window. Does text appear instantly? (Convex Realtime).
2.  **The "Combo" Check:**
    * Click "Start Lecture Mode" button.
    * Press `Alt+N` (simulate VoiceNotes recording).
    * **Success:** Note appears in the *correct* project automatically.
3.  **The "Protection" Check:** Click "Backup Now". Verify file in Google Drive.