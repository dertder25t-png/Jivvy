import { create } from 'zustand';

type ProjectCenterMode = "canvas" | "paper" | "notes";

interface ProjectState {
    activeProjectId: string | null;
    centerMode: ProjectCenterMode;
    setActiveProjectId: (id: string | null) => void;
    setCenterMode: (mode: ProjectCenterMode) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
    activeProjectId: null,
    centerMode: "canvas",
    setActiveProjectId: (id) => set({ activeProjectId: id }),
    setCenterMode: (mode) => set({ centerMode: mode }),
}));
