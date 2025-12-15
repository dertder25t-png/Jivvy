import { create } from 'zustand';

type ProjectCenterMode = "canvas" | "paper" | "notes";

interface ProjectState {
    activeProjectId: string | null;
    centerMode: ProjectCenterMode;
    pdfPage: number;
    setActiveProjectId: (id: string | null) => void;
    setCenterMode: (mode: ProjectCenterMode) => void;
    setPdfPage: (page: number) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
    activeProjectId: null,
    centerMode: "canvas",
    pdfPage: 1,
    setActiveProjectId: (id) => set({ activeProjectId: id }),
    setCenterMode: (mode) => set({ centerMode: mode }),
    setPdfPage: (page) => set({ pdfPage: page }),
}));
