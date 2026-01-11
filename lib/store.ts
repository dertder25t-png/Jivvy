import { create } from 'zustand';
import { db, Block, Project, safeDbOperation, safeDbResult } from './db';
import type { AppError } from './errors';
import { toAppError, createAppError } from './errors';
import { createClient } from '@/utils/supabase/client';

type ProjectCenterMode = "canvas" | "paper" | "notes" | "extraction";

interface ProjectState {
    activeProjectId: string | null;
    centerMode: ProjectCenterMode;
    pdfPage: number;
    activePdfUrl: string | null;
    pdfHighlightRanges: Array<{ startPage: number; endPage: number | null }>;
    blocks: Block[];
    contextPanelOpen: boolean;
    contextPanelView: 'flashcards' | 'chat';
    isLoading: boolean;
    error: AppError | null;

    setActiveProjectId: (id: string | null) => void;
    setCenterMode: (mode: ProjectCenterMode) => void;
    setPdfPage: (page: number) => void;
    setPdfUrl: (url: string | null) => void;
    setPdfHighlightRanges: (ranges: Array<{ startPage: number; endPage: number | null }>) => void;
    setContextPanelOpen: (open: boolean) => void;
    setContextPanelView: (view: 'flashcards' | 'chat') => void;

    // Block Actions
    loadBlocks: (parentId: string) => Promise<void>;
    addBlock: (block: Block) => Promise<{ ok: true } | { ok: false; error: AppError }>;
    updateBlock: (id: string, updates: Partial<Block>) => Promise<void>;
    deleteBlock: (id: string) => Promise<void>;
    reorderBlocks: (blocks: Block[]) => Promise<void>;

    // Dashboard Data
    dashboardView: 'inbox' | 'today' | 'upcoming' | 'ai-chat';
    setDashboardView: (view: 'inbox' | 'today' | 'upcoming' | 'ai-chat') => void;
    projects: Project[];
    loadProjects: () => Promise<void>;
    addProject: (project: Project) => Promise<{ ok: true } | { ok: false; error: AppError }>;
    updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    getRecentProjects: () => Promise<Project[]>;
    getUpcomingTasks: () => Promise<Block[]>;

    // Error handling
    clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    activeProjectId: null,
    centerMode: "canvas",
    pdfPage: 1,
    activePdfUrl: null,
    pdfHighlightRanges: [],
    blocks: [],
    contextPanelOpen: false,
    contextPanelView: 'flashcards',
    dashboardView: 'inbox',
    projects: [],
    isLoading: false,
    error: null,

    setDashboardView: (view) => set({ dashboardView: view }),
    setActiveProjectId: (id) => set({ activeProjectId: id }),
    setCenterMode: (mode) => set({ centerMode: mode }),
    setPdfPage: (page) => set({ pdfPage: page }),
    setPdfUrl: (url) => set({ activePdfUrl: url }),
    setPdfHighlightRanges: (ranges) => set({ pdfHighlightRanges: ranges }),
    setContextPanelOpen: (open) => set({ contextPanelOpen: open }),
    setContextPanelView: (view) => set({ contextPanelView: view }),

    loadProjects: async () => {
        const res = await safeDbResult(() => db.projects.toArray());
        if (res.error) {
            set({ error: res.error });
            return;
        }
        set({ projects: res.data ?? [] });
    },

    addProject: async (project) => {
        // Write to Local (Dexie) first for immediate offline support
        const res = await safeDbResult(() => db.projects.add(project));
        if (res.error) {
            set({ error: res.error });
            return { ok: false as const, error: res.error };
        }
        set((state) => ({ projects: [...state.projects, project] }));
        
        // Sync to Cloud (Supabase) in background - don't block on this
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
                await supabase.from('projects').upsert({
                    id: project.id,
                    user_id: user.id,
                    title: project.name,
                    category: (project.metadata as any)?.category || 'General',
                    pdf_url: (project.metadata as any)?.pdf_url || null,
                    extracted_constraints: project.metadata || {},
                    created_at: new Date(project.created_at).toISOString(),
                    updated_at: new Date(project.updated_at).toISOString(),
                });
                console.log('[Store] Project synced to cloud:', project.id);
            }
        } catch (cloudError) {
            // Log but don't fail - local save succeeded
            console.warn('[Store] Failed to sync project to cloud:', cloudError);
        }
        
        return { ok: true as const };
    },

    updateProject: async (id, updates) => {
        const res = await safeDbResult(() => db.projects.update(id, updates));
        if (res.error) {
            set({ error: res.error });
            return;
        }
        set((state) => ({
            projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p)
        }));
    },

    deleteProject: async (id) => {
        console.log("Store: Deleting project", id);
        const del = await safeDbResult(() => db.projects.delete(id));
        if (del.error) {
            console.error("Store: Failed to delete project", del.error);
            set({ error: del.error });
            return;
        }
        console.log("Store: Project deleted from DB", id);

        // Refresh local state by filtering
        set((state) => ({
            projects: state.projects.filter(p => p.id !== id)
        }));

        // Force a re-fetch to be absolutely sure
        const projectsRes = await safeDbResult(() => db.projects.toArray());
        if (projectsRes.error) {
            set({ error: projectsRes.error });
            return;
        }
        set({ projects: projectsRes.data ?? [] });
        console.log("Store: Projects state refreshed", (projectsRes.data ?? []).length);
    },

    clearError: () => set({ error: null }),

    loadBlocks: async (parentId) => {
        set({ isLoading: true, error: null });
        const res = await safeDbResult(() =>
            db.blocks.where('parent_id').equals(parentId).sortBy('order')
        );
        if (res.error) {
            set({ error: res.error, isLoading: false });
            return;
        }
        set({ blocks: res.data ?? [], isLoading: false });
    },

    addBlock: async (block) => {
        const currentBlocks = get().blocks;
        set({ blocks: [...currentBlocks, block] }); // Optimistic update
        const res = await safeDbResult(() => db.blocks.add(block));
        if (res.error) {
            set({ blocks: currentBlocks, error: res.error });
            return { ok: false as const, error: res.error };
        }
        return { ok: true as const };
    },

    updateBlock: async (id, updates) => {
        const currentBlocks = get().blocks;
        const updatedBlocks = currentBlocks.map(b => b.id === id ? { ...b, ...updates } : b);
        set({ blocks: updatedBlocks });

        const res = await safeDbResult(() => db.blocks.update(id, updates));
        if (res.error) {
            set({ blocks: currentBlocks, error: res.error });
        }
    },

    deleteBlock: async (id) => {
        const currentBlocks = get().blocks;
        set({ blocks: currentBlocks.filter(b => b.id !== id) });
        const res = await safeDbResult(() => db.blocks.delete(id));
        if (res.error) {
            set({ blocks: currentBlocks, error: res.error });
        }
    },

    reorderBlocks: async (newBlocks) => {
        // Optimistic update of state
        set({ blocks: newBlocks });

        try {
            await safeDbOperation(async () => {
                await db.transaction('rw', db.blocks, async () => {
                    for (const block of newBlocks) {
                        // Only update 'order', assume other fields didn't change in this action
                        await db.blocks.update(block.id, { order: block.order });
                    }
                });
            });
        } catch (e: any) {
            set({ error: toAppError(e, { code: 'DB_REORDER_FAILED', message: 'Failed to reorder blocks', retryable: true }) });
            // Reload to restore consistency
            const parentId = newBlocks[0]?.parent_id;
            if (parentId) {
                const res = await safeDbResult(() => db.blocks.where('parent_id').equals(parentId).sortBy('order'));
                if (res.error) {
                    set({ error: res.error });
                    return;
                }
                set({ blocks: res.data ?? [] });
            }
        }
    },

    getRecentProjects: async () => {
        try {
            return await safeDbOperation(() => db.projects.orderBy('updated_at').reverse().limit(3).toArray());
        } catch (e) {
            console.error('Failed to fetch recent projects', e);
            return [];
        }
    },

    getUpcomingTasks: async () => {
        try {
            const now = Date.now();
            const tomorrow = now + 24 * 60 * 60 * 1000;

            // Use compound index to avoid full scans: [type + properties.due_date]
            return await safeDbOperation(async () => {
                return db.blocks
                    .where('[type+properties.due_date]')
                    .between(['task', now], ['task', tomorrow], true, true)
                    .toArray();
            });
        } catch (e) {
            console.error('Failed to fetch upcoming tasks', e);
            return [];
        }
    }
}));
