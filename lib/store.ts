import { create } from 'zustand';
import { db, Block, Project, BlockType, safeDbOperation } from './db';

type ProjectCenterMode = "canvas" | "paper" | "notes" | "extraction";

interface ProjectState {
    activeProjectId: string | null;
    centerMode: ProjectCenterMode;
    pdfPage: number;
    activePdfUrl: string | null;
    pdfHighlightRanges: Array<{ startPage: number; endPage: number | null }>;
    blocks: Block[];
    contextPanelOpen: boolean;
    isLoading: boolean;
    error: string | null;

    setActiveProjectId: (id: string | null) => void;
    setCenterMode: (mode: ProjectCenterMode) => void;
    setPdfPage: (page: number) => void;
    setPdfUrl: (url: string | null) => void;
    setPdfHighlightRanges: (ranges: Array<{ startPage: number; endPage: number | null }>) => void;
    setContextPanelOpen: (open: boolean) => void;

    // Block Actions
    loadBlocks: (parentId: string) => Promise<void>;
    addBlock: (block: Block) => Promise<void>;
    updateBlock: (id: string, updates: Partial<Block>) => Promise<void>;
    deleteBlock: (id: string) => Promise<void>;
    reorderBlocks: (blocks: Block[]) => Promise<void>;

    // Dashboard Data
    dashboardView: 'inbox' | 'today' | 'upcoming';
    setDashboardView: (view: 'inbox' | 'today' | 'upcoming') => void;
    projects: Project[];
    loadProjects: () => Promise<void>;
    addProject: (project: Project) => Promise<void>;
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

    loadProjects: async () => {
        try {
            const projects = await safeDbOperation(() => db.projects.toArray());
            set({ projects });
        } catch (e: any) {
            set({ error: e.message || 'Failed to load projects' });
        }
    },

    addProject: async (project) => {
        try {
            await safeDbOperation(() => db.projects.add(project));
            set((state) => ({ projects: [...state.projects, project] }));
        } catch (e: any) {
            set({ error: e.message || 'Failed to add project' });
        }
    },

    updateProject: async (id, updates) => {
        try {
            await safeDbOperation(() => db.projects.update(id, updates));
            set((state) => ({
                projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p)
            }));
        } catch (e: any) {
            set({ error: e.message || 'Failed to update project' });
        }
    },

    deleteProject: async (id) => {
        console.log("Store: Deleting project", id);
        try {
            await safeDbOperation(() => db.projects.delete(id));
            console.log("Store: Project deleted from DB", id);

            // Refresh local state by filtering
            set((state) => ({
                projects: state.projects.filter(p => p.id !== id)
            }));

            // Force a re-fetch to be absolutely sure
            const projects = await db.projects.toArray();
            set({ projects });
            console.log("Store: Projects state refreshed", projects.length);
        } catch (e: any) {
            console.error("Store: Failed to delete project", e);
            set({ error: e.message || 'Failed to delete project' });
        }
    },

    clearError: () => set({ error: null }),

    loadBlocks: async (parentId) => {
        set({ isLoading: true, error: null });
        try {
            const blocks = await safeDbOperation(() =>
                db.blocks.where('parent_id').equals(parentId).sortBy('order')
            );
            set({ blocks, isLoading: false });
        } catch (e: any) {
            set({ error: e.message || 'Failed to load blocks', isLoading: false });
        }
    },

    addBlock: async (block) => {
        const currentBlocks = get().blocks;
        set({ blocks: [...currentBlocks, block] }); // Optimistic update
        try {
            await safeDbOperation(() => db.blocks.add(block));
        } catch (e: any) {
            set({ blocks: currentBlocks, error: e.message || 'Failed to add block' });
        }
    },

    updateBlock: async (id, updates) => {
        const currentBlocks = get().blocks;
        const updatedBlocks = currentBlocks.map(b => b.id === id ? { ...b, ...updates } : b);
        set({ blocks: updatedBlocks });

        try {
            await safeDbOperation(() => db.blocks.update(id, updates));
        } catch (e: any) {
            set({ blocks: currentBlocks, error: e.message || 'Failed to update block' });
        }
    },

    deleteBlock: async (id) => {
        const currentBlocks = get().blocks;
        set({ blocks: currentBlocks.filter(b => b.id !== id) });
        try {
            await safeDbOperation(() => db.blocks.delete(id));
        } catch (e: any) {
            set({ blocks: currentBlocks, error: e.message || 'Failed to delete block' });
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
            set({ error: e.message || 'Failed to reorder blocks' });
            // Reload to restore consistency
            const parentId = newBlocks[0]?.parent_id;
            if (parentId) {
                const blocks = await db.blocks.where('parent_id').equals(parentId).sortBy('order');
                set({ blocks });
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

            // This is a naive implementation as we don't have a direct index on due_date in Block
            // In a real app with many blocks, we should index metadata.due_date
            return await safeDbOperation(async () => {
                const tasks = await db.blocks.where('type').equals('task').toArray();
                return tasks.filter(task => {
                    const dueDate = task.metadata?.due_date;
                    return dueDate && dueDate >= now && dueDate <= tomorrow;
                });
            });
        } catch (e) {
            console.error('Failed to fetch upcoming tasks', e);
            return [];
        }
    }
}));
