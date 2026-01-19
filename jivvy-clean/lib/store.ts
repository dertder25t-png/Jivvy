import { create } from 'zustand';
import { db, type Block, type Project } from './db';
import { type SuggestedFlashcard } from './pattern-engine';
import { v4 as uuidv4 } from 'uuid';

interface AppState {
    currentProjectId: string | null;
    blocks: Block[];
    projects: Project[];
    isLoading: boolean;
    dashboardView: 'inbox' | 'today' | 'upcoming' | 'ai-chat' | 'project';
    contextPanelOpen: boolean;
    contextPanelView: 'flashcards' | 'research' | 'chat';
    flashcardTab: 'suggestions' | 'manual';
    pdfPage: number | null;

    // View State
    viewLayout: 'list' | 'board' | 'calendar';
    viewGrouping: 'none' | 'project' | 'date';
    viewSorting: 'smart' | 'date' | 'priority' | 'alpha';
    showCompletedTasks: boolean;

    setViewLayout: (layout: 'list' | 'board' | 'calendar') => void;
    setViewGrouping: (grouping: 'none' | 'project' | 'date') => void;
    setViewSorting: (sorting: 'smart' | 'date' | 'priority' | 'alpha') => void;
    setShowCompletedTasks: (show: boolean) => void;

    // Actions
    setDashboardView: (view: 'inbox' | 'today' | 'upcoming' | 'ai-chat' | 'project') => void;
    setContextPanelOpen: (open: boolean) => void;
    setContextPanelView: (view: 'flashcards' | 'research' | 'chat') => void;
    setFlashcardTab: (tab: 'suggestions' | 'manual') => void;
    setPdfPage: (page: number) => void;

    loadProject: (id: string) => Promise<void>;
    createBlock: (parentId: string, type: Block['type'], order: number) => Promise<void>;
    addBlock: (block: Block) => Promise<void>;
    setBlocks: (blocks: Block[] | ((prev: Block[]) => Block[])) => void;
    updateBlock: (id: string, changes: Partial<Block>) => Promise<void>;
    deleteBlock: (id: string) => Promise<void>;
    reorderBlocks: (activeId: string, overId: string) => Promise<void>;

    // Flashcard State
    suggestedFlashcards: SuggestedFlashcard[];
    addSuggestion: (suggestion: SuggestedFlashcard) => void;
    clearSuggestionsForBlock: (blockId: string) => void;
    dismissSuggestion: (id: string) => void;

    // Manual Flashcard State
    manualFlashcardData: { front: string; back: string };
    setManualFlashcardData: (data: { front: string; back: string }) => void;
}

export const useStore = create<AppState>((set, get) => ({
    currentProjectId: null,
    blocks: [],
    projects: [],
    isLoading: false,
    dashboardView: 'inbox',
    contextPanelOpen: false,
    contextPanelView: 'research',
    flashcardTab: 'suggestions',
    pdfPage: null,

    viewLayout: 'list',
    viewGrouping: 'none',
    viewSorting: 'smart',
    showCompletedTasks: false,

    setViewLayout: (layout) => set({ viewLayout: layout }),
    setViewGrouping: (grouping) => set({ viewGrouping: grouping }),
    setViewSorting: (sorting) => set({ viewSorting: sorting }),
    setShowCompletedTasks: (show) => set({ showCompletedTasks: show }),

    setDashboardView: (view) => set({ dashboardView: view }),
    setContextPanelOpen: (open) => set({ contextPanelOpen: open }),
    setContextPanelView: (view) => set({ contextPanelView: view }),
    setFlashcardTab: (tab) => set({ flashcardTab: tab }),
    setPdfPage: (page: number) => set({ pdfPage: page }),

    loadProject: async (id: string) => {
        set({ isLoading: true, currentProjectId: id });
        try {
            const blocks = await db.blocks
                .where('parent_id')
                .equals(id)
                .sortBy('order');
            set({ blocks, isLoading: false });
        } catch (err) {
            console.error('Failed to load project', err);
            set({ isLoading: false });
        }
    },

    addBlock: async (block: Block) => {
        // Optimistic
        set(state => ({
            blocks: [...state.blocks, block].sort((a, b) => a.order - b.order)
        }));
        await db.blocks.add(block);
    },

    setBlocks: (updater) => {
        set(state => ({
            blocks: typeof updater === 'function' ? updater(state.blocks) : updater
        }));
    },

    createBlock: async (parentId: string, type, order) => {
        const newBlock: Block = {
            id: uuidv4(),
            parent_id: parentId,
            type,
            content: '',
            order,
            updated_at: Date.now(),
            sync_status: 'dirty'
        };

        // Optimistic Update
        set(state => ({
            blocks: [...state.blocks.slice(0, order), newBlock, ...state.blocks.slice(order)].map((b, idx) => ({ ...b, order: idx }))
        }));

        // Async DB write
        await db.blocks.add(newBlock);
    },

    updateBlock: async (id: string, changes: Partial<Block>) => {
        // Optimistic Update
        set(state => ({
            blocks: state.blocks.map(b => b.id === id ? { ...b, ...changes } : b)
        }));

        // Async DB write
        await db.blocks.where('id').equals(id).modify(changes);
    },

    deleteBlock: async (id: string) => {
        set(state => ({
            blocks: state.blocks.filter(b => b.id !== id)
        }));
        await db.blocks.where('id').equals(id).delete();
    },

    reorderBlocks: async (activeId: string, overId: string) => {
        console.log('Reorder', activeId, overId);
    },

    suggestedFlashcards: [],
    addSuggestion: (suggestion) => set(state => {
        const existing = state.suggestedFlashcards.find(s => s.blockId === suggestion.blockId && s.originalText === suggestion.originalText);
        if (existing) return state;
        return { suggestedFlashcards: [...state.suggestedFlashcards, suggestion] };
    }),
    clearSuggestionsForBlock: (blockId: string) => set(state => ({
        suggestedFlashcards: state.suggestedFlashcards.filter(s => s.blockId !== blockId)
    })),
    dismissSuggestion: (id) => set(state => ({
        suggestedFlashcards: state.suggestedFlashcards.filter(s => s.id !== id)
    })),

    manualFlashcardData: { front: '', back: '' },
    setManualFlashcardData: (data) => set({ manualFlashcardData: data })
}));
