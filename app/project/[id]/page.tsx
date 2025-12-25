"use client";


import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
    Upload, FileText, Loader2, Eye, PenTool, StickyNote,
    ChevronLeft, ChevronRight, Sparkles
} from "lucide-react";
import { getProject, createProject, getProjectNotes, saveProjectNote, type Project } from "../actions";
import { uploadPDF } from "@/utils/supabase/storage";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { DesignDoctorTool } from "@/components/workspace/DesignDoctorTool";
import { useProjectStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/store/settings";

const PDFViewer = dynamic(() => import("@/components/workspace/PDFViewer").then(mod => mod.PDFViewer), {
    ssr: false,
    loading: () => <div className="h-full w-full flex items-center justify-center text-zinc-500">Initializing PDF Engine...</div>
});

const InfiniteCanvas = dynamic(() => import("@/components/workspace/InfiniteCanvas").then(mod => mod.InfiniteCanvas), {
    ssr: false,
    loading: () => <div className="h-full w-full flex items-center justify-center text-zinc-500">Loading Canvas...</div>
});

const Notebook = dynamic(() => import("@/components/workspace/Notebook").then(mod => mod.Notebook), {
    ssr: false,
    loading: () => <div className="h-full w-full flex items-center justify-center text-zinc-500">Loading Notebook...</div>
});

const SourceDrawer = dynamic(() => import("@/components/workspace/SourceDrawer").then(mod => mod.SourceDrawer), {
    ssr: false,
    loading: () => null
});

const SpecSidebar = dynamic(() => import("@/components/workspace/SpecSidebar").then(mod => mod.SpecSidebar), {
    ssr: false,
    loading: () => null
});

const FlashcardSidebar = dynamic(() => import("@/components/workspace/FlashcardSidebar").then(mod => mod.FlashcardSidebar), {
    ssr: false,
    loading: () => null
});

const BlockEditor = dynamic(() => import("@/components/BlockEditor").then(mod => mod.BlockEditor), {
    ssr: false,
    loading: () => <div className="h-full w-full flex items-center justify-center text-zinc-500">Loading Editor...</div>
});

import { AppShell } from "@/components/layout/AppShell";

// Mock spec items for the properties panel
export default function ProjectPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    // Global Store
    const { centerMode, setCenterMode, setActiveProjectId } = useProjectStore();
    const { drawerPosition } = useSettingsStore();

    // Init PDF worker on client
    useEffect(() => {
        if (typeof window !== 'undefined') {
            import("@/lib/pdf-init");
        }
    }, []);

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    // Removed local centerMode state in favor of store
    const [squintAmount, setSquintAmount] = useState(0);
    const [onboardingComplete, setOnboardingComplete] = useState(false);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [toolSwitcherOpen, setToolSwitcherOpen] = useState(true);

    // Notes state
    const [notesLoaded, setNotesLoaded] = useState(false);
    const [paperContent, setPaperContent] = useState("");
    const [notesContent, setNotesContent] = useState("");

    // Set Active Project ID on Mount
    useEffect(() => {
        setActiveProjectId(projectId);
        return () => setActiveProjectId(null); // Cleanup
    }, [projectId, setActiveProjectId]);

    // Sync PDF URL to Store for Context Panel
    const { setPdfUrl } = useProjectStore();
    useEffect(() => {
        if (project?.pdf_url) {
            setPdfUrl(project.pdf_url);
        }
    }, [project?.pdf_url, setPdfUrl]);

    // Fetch project data and notes
    useEffect(() => {
        async function fetchProjectData() {
            if (projectId === 'new') {
                setLoading(false);
                setNotesLoaded(true); // Enable notes/paper for new projects
                return;
            }

            // Fetch project details
            const { project: data, error } = await getProject(projectId);
            if (!error && data) {
                setProject(data);
                setOnboardingComplete(true); // Existing project - skip onboarding
                // Only show left panel if there's a PDF
                if (data.pdf_url) {
                    setLeftPanelCollapsed(false);
                }
            }

            // Fetch notes
            const { notes, error: notesError } = await getProjectNotes(projectId);
            if (!notesError && notes) {
                // Order 0 = Lecture Notes, Order 1 = Paper
                const lectureNotes = notes.find(n => n.order === 0);
                const paper = notes.find(n => n.order === 1);

                if (lectureNotes) setNotesContent(lectureNotes.content);
                if (paper) setPaperContent(paper.content);
            }
            setNotesLoaded(true);

            setLoading(false);
        }
        fetchProjectData();
    }, [projectId]);

    const handleFileUpload = useCallback(async (file: File) => {
        if (!file.type.includes('pdf')) {
            alert('Please upload a PDF file');
            return;
        }
        setUploading(true);
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert('Please sign in to upload files');
                setUploading(false);
                return;
            }
            const pdfUrl = await uploadPDF(file, user.id);
            if (!pdfUrl) {
                alert('Failed to upload PDF');
                setUploading(false);
                return;
            }
            const { project: newProject, error } = await createProject(pdfUrl);
            if (error) {
                alert(`Failed to create project: ${error}`);
                setUploading(false);
                return;
            }
            setProject(newProject);
            setLeftPanelCollapsed(false);
            if (newProject && projectId === 'new') {
                window.history.replaceState({}, '', `/project/${newProject.id}`);
            }
        } catch (err) {
            console.error('Upload error:', err);
            alert('An error occurred during upload');
        }
        setUploading(false);
    }, [projectId]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file);
    }, [handleFileUpload]);

    const handleSavePaper = useCallback(async (content: string) => {
        setPaperContent(content);
        await saveProjectNote(projectId, content, 1);
    }, [projectId]);

    const handleSaveNotes = useCallback(async (content: string) => {
        setNotesContent(content);
        await saveProjectNote(projectId, content, 0);
    }, [projectId]);

    // Create a new project and redirect to it
    const handleStartProject = useCallback(async (mode: 'canvas' | 'paper' | 'notes') => {
        // If already on a real project, just set the mode
        if (projectId !== 'new') {
            setCenterMode(mode);
            setLeftPanelCollapsed(false);
            setOnboardingComplete(true);
            return;
        }

        // Create a new project in the database
        setIsCreatingProject(true);
        console.log('[handleStartProject] Creating new project with mode:', mode);

        const titleMap = {
            canvas: 'New Design Project',
            paper: 'New Paper',
            notes: 'Lecture Notes'
        };

        try {
            const { project: newProject, error } = await createProject(
                undefined, // no PDF
                titleMap[mode],
                mode === 'canvas' ? 'Design' : mode === 'paper' ? 'Writing' : 'Education'
            );

            console.log('[handleStartProject] Result:', { newProject, error });

            if (error || !newProject) {
                console.error('[handleStartProject] Failed to create project:', error);
                alert(`Failed to create project: ${error || 'Unknown error'}`);
                setIsCreatingProject(false);
                return;
            }

            // Set the mode before redirecting
            setCenterMode(mode);
            setActiveProjectId(newProject.id);

            // Redirect to the new project
            console.log('[handleStartProject] Redirecting to:', `/project/${newProject.id}`);
            router.replace(`/project/${newProject.id}`);
        } catch (err) {
            console.error('[handleStartProject] Exception:', err);
            alert(`Error creating project: ${err instanceof Error ? err.message : 'Unknown error'}`);
            setIsCreatingProject(false);
        }
    }, [projectId, setCenterMode, setActiveProjectId, router]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-surface">
                <Loader2 className="animate-spin text-lime-400" size={32} />
            </div>
        );
    }

    return (
        <AppShell>
            <div className="h-full w-full relative flex flex-col">
                {/* Mode Switcher (Tab Bar) */}
                <div className="flex items-center gap-2 p-4 border-b border-zinc-200 dark:border-zinc-800">
                    <button
                        onClick={() => setCenterMode('canvas')}
                        className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors", centerMode === 'canvas' ? "bg-zinc-100 dark:bg-zinc-800 text-primary" : "text-text-secondary hover:text-text-primary")}
                    >
                        Canvas
                    </button>
                    <button
                        onClick={() => setCenterMode('paper')}
                        className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors", centerMode === 'paper' ? "bg-zinc-100 dark:bg-zinc-800 text-primary" : "text-text-secondary hover:text-text-primary")}
                    >
                        Editor
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden relative">
                    {centerMode === 'canvas' && (
                        <div className="h-full w-full relative">
                            <InfiniteCanvas blurAmount={squintAmount} className="h-full" projectId={projectId} />

                            {/* Squint Slider (Floating) */}
                            <div className="absolute bottom-6 left-6 z-20 flex items-center gap-3 bg-zinc-900/90 backdrop-blur-xl p-3 rounded-2xl border border-zinc-800 shadow-xl">
                                <Eye size={16} className="text-zinc-400" />
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={squintAmount}
                                    onChange={(e) => setSquintAmount(Number(e.target.value))}
                                    className="w-32 h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer"
                                />
                                <span className="text-xs font-mono text-lime-400 w-8 text-right">{squintAmount}%</span>
                            </div>
                        </div>
                    )}

                    {(centerMode === 'paper' || centerMode === 'notes' || centerMode === 'extraction') && (
                        <BlockEditor projectId={projectId} />
                    )}
                </div>
            </div>
        </AppShell>
    );
}
