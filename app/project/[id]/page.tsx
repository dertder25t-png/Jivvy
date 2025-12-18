"use client";


import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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

const ExtractionWorkspace = dynamic(() => import("@/components/workspace/ExtractionWorkspace").then(mod => mod.ExtractionWorkspace), {
    ssr: false,
    loading: () => null
});

// Mock spec items for the properties panel
export default function ProjectPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const projectId = params.id as string;

    // Global Store
    const { centerMode, setCenterMode, setActiveProjectId } = useProjectStore();
    const { drawerPosition } = useSettingsStore();

    // Sync URL mode to store
    useEffect(() => {
        const mode = searchParams.get('mode');
        if (mode && ['canvas', 'paper', 'notes'].includes(mode)) {
            setCenterMode(mode as 'canvas' | 'paper' | 'notes');
        }
    }, [searchParams, setCenterMode]);

    // Init PDF worker on client
    useEffect(() => {
        if (typeof window !== 'undefined') {
            import("@/lib/pdf-init");
        }
    }, []);

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [mobileTab, setMobileTab] = useState<'reference' | 'workspace'>('workspace');

    // Auto-switch to reference tab if PDF is uploaded on mobile
    useEffect(() => {
        if (project?.pdf_url && window.innerWidth < 1024) {
            setMobileTab('reference');
        }
    }, [project?.pdf_url]);

    const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [squintAmount, setSquintAmount] = useState(0);
    const [onboardingComplete, setOnboardingComplete] = useState(false);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [toolSwitcherOpen, setToolSwitcherOpen] = useState(true);

    // Tools Drawer State
    const [toolsOpen, setToolsOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // Notes state
    const [notesLoaded, setNotesLoaded] = useState(false);
    const [paperContent, setPaperContent] = useState("");
    const [notesContent, setNotesContent] = useState("");

    // Detect Mobile
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            // On initial load, close tools on mobile
            if (mobile && toolsOpen) setToolsOpen(false);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Set Active Project ID on Mount
    useEffect(() => {
        setActiveProjectId(projectId);
        return () => setActiveProjectId(null); // Cleanup
    }, [projectId, setActiveProjectId]);

    // Collapse left panel if no PDF
    useEffect(() => {
        if (!project?.pdf_url) {
            setLeftPanelCollapsed(true);
        }
    }, [project]);

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
            <div className="flex h-full w-full items-center justify-center bg-surface">
                <Loader2 className="animate-spin text-lime-400" size={32} />
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col overflow-hidden bg-background relative">

            {/* MOBILE HEADER: Project Nav & Tab Toggle */}
            <div className="lg:hidden h-14 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-950/50 backdrop-blur-md z-30 flex-shrink-0">
                <button onClick={() => router.push('/')} className="p-2 -ml-2 text-zinc-400 hover:text-white">
                    <ChevronLeft size={20} />
                </button>

                {/* Center Toggle */}
                <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                    <button
                        onClick={() => setMobileTab('reference')}
                        className={cn(
                            "px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
                            mobileTab === 'reference' ? "bg-zinc-800 text-lime-400 shadow-sm" : "text-zinc-500"
                        )}
                    >
                        <FileText size={12} />
                        Ref
                    </button>
                    <button
                        onClick={() => setMobileTab('workspace')}
                        className={cn(
                            "px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
                            mobileTab === 'workspace' ? "bg-zinc-800 text-lime-400 shadow-sm" : "text-zinc-500"
                        )}
                    >
                        {centerMode === 'canvas' ? <PenTool size={12} /> : <StickyNote size={12} />}
                        Work
                    </button>
                </div>

                <div className="w-8" /> {/* Spacer */}
            </div>

            <div className="flex-1 flex overflow-hidden relative">

                {/* LEFT PANEL / REFERENCE TAB */}
                {/* Desktop: Show if not collapsed. Mobile: Show only if tab is 'reference' */}
                <div className={cn(
                    "flex-col border-r border-zinc-800 bg-background transition-all duration-300 z-20",
                    // Desktop styles
                    "lg:flex",
                    leftPanelCollapsed ? "lg:w-0 lg:border-r-0 overflow-hidden" : "lg:w-[350px] lg:min-w-[350px]",
                    // Mobile styles
                    mobileTab === 'reference' ? "flex absolute inset-0 w-full z-40" : "hidden lg:flex lg:relative"
                )}>
                    {(!leftPanelCollapsed || mobileTab === 'reference') && (
                        <>
                            {/* Panel Header (Desktop Only) */}
                            <div className="hidden lg:flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                                    {project?.title || 'Design Brief'}
                                </span>
                                <button
                                    onClick={() => setLeftPanelCollapsed(true)}
                                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                            </div>

                            {/* PDF Content or Empty State */}
                            <div className="flex-1 overflow-hidden p-0 lg:p-3 relative">
                                {project?.pdf_url ? (
                                    <PDFViewer url={project.pdf_url} className="h-full w-full lg:rounded-xl" />
                                ) : (
                                    <div
                                        className={cn(
                                            "h-full w-full flex flex-col items-center justify-center lg:rounded-2xl border-2 border-dashed transition-all p-8 text-center",
                                            dragOver ? 'border-lime-400 bg-lime-400/10' : 'border-zinc-800 hover:border-zinc-700'
                                        )}
                                        onDrop={handleDrop}
                                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                        onDragLeave={() => setDragOver(false)}
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 className="animate-spin text-lime-400 mb-3" size={32} />
                                                <p className="text-zinc-400 text-sm">Uploading...</p>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center mb-4 ring-1 ring-white/10">
                                                    <Upload className="text-lime-400" size={24} />
                                                </div>
                                                <h3 className="text-white font-bold mb-2">Upload Reference</h3>
                                                <p className="text-zinc-500 text-sm mb-6 max-w-[200px]">Drag & drop a PDF here to use as context for your project.</p>
                                                <label className="cursor-pointer">
                                                    <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleFileUpload(file);
                                                    }} />
                                                    <div className="px-6 py-2.5 bg-lime-400 hover:bg-lime-300 text-black font-bold rounded-lg transition-colors text-sm">
                                                        Select PDF
                                                    </div>
                                                </label>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Desktop Expand Button (when Left Panel is collapsed) */}
                {leftPanelCollapsed && (
                    <div className="hidden lg:flex h-full flex-col border-r border-zinc-800 bg-zinc-950/30">
                        <button
                            onClick={() => setLeftPanelCollapsed(false)}
                            className="h-12 w-10 flex items-center justify-center hover:bg-zinc-800/50 transition-colors group border-b border-zinc-800"
                            title="Expand Reference"
                        >
                            <ChevronRight size={16} className="text-zinc-500 group-hover:text-lime-400" />
                        </button>
                    </div>
                )}


                {/* CENTER PANEL - WORKSPACE */}
                {/* Mobile: Show if tab is 'workspace'. Desktop: Always show */}
                <div className={cn(
                    "flex-1 flex flex-col overflow-hidden relative transition-opacity duration-300",
                    mobileTab === 'workspace' ? "opacity-100 z-10" : "opacity-0 pointer-events-none lg:opacity-100 lg:pointer-events-auto"
                )}>

                    {/* Extraction mode handles its own layout */}
                    {centerMode === 'extraction' ? (
                        <ExtractionWorkspace
                            pdfUrl={project?.pdf_url ?? null}
                            onPdfUploaded={(url) => setProject(prev => prev ? { ...prev, pdf_url: url } : null)}
                        />
                    ) : (
                        /* Standard Workspace (Canvas/Notes) */
                        <div className="flex-1 flex overflow-hidden relative">
                            {/* Squint Slider (Floating - only on Canvas) */}
                            {centerMode === 'canvas' && (
                                <div className="hidden md:flex absolute bottom-6 left-6 z-20 items-center gap-3 bg-zinc-900/90 backdrop-blur-xl p-3 rounded-2xl border border-zinc-800 shadow-xl">
                                    <Eye size={16} className="text-zinc-400" />
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Squint Test</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={squintAmount}
                                            onChange={(e) => setSquintAmount(Number(e.target.value))}
                                            className="w-32 h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-lime-400"
                                        />
                                    </div>
                                    <span className="text-xs font-mono text-lime-400 w-8 text-right">{squintAmount}%</span>
                                </div>
                            )}

                            {/* CANVAS AREA */}
                            <div
                                className="flex-1 overflow-hidden lg:p-6 bg-surface relative"
                                onDrop={handleDrop}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                            >
                                {/* Design Doctor Floating Tool (Canvas mode only) */}
                                {centerMode === 'canvas' && <div className="absolute top-4 right-4 z-40"><DesignDoctorTool /></div>}

                                {/* Full-Screen Onboarding Overlay - Only for new projects */}
                                {projectId === 'new' && !project?.pdf_url && leftPanelCollapsed && !onboardingComplete && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
                                        <div
                                            className={cn(
                                                "bg-zinc-900 rounded-3xl border border-zinc-800 p-8 text-center max-w-md w-full shadow-2xl",
                                                dragOver && "border-lime-400 bg-lime-400/5"
                                            )}
                                            onDrop={handleDrop}
                                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                            onDragLeave={() => setDragOver(false)}
                                        >
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-lime-400/20 to-violet-500/20 flex items-center justify-center mx-auto mb-4">
                                                <Sparkles className="text-lime-400" size={28} />
                                            </div>
                                            <h2 className="text-xl font-bold text-white mb-2">What are you creating?</h2>
                                            <p className="text-zinc-400 text-sm mb-6">Choose your workspace to get started</p>

                                            {/* Project Type Cards */}
                                            <div className="grid grid-cols-3 gap-3 mb-6">
                                                <button
                                                    onClick={() => handleStartProject('canvas')}
                                                    disabled={isCreatingProject}
                                                    className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-zinc-700 hover:border-lime-400 hover:bg-lime-400/5 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-10 h-10 rounded-xl bg-zinc-800 group-hover:bg-lime-400/20 flex items-center justify-center transition-colors">
                                                        {isCreatingProject ? (
                                                            <Loader2 size={18} className="text-zinc-400 animate-spin" />
                                                        ) : (
                                                            <PenTool size={18} className="text-zinc-400 group-hover:text-lime-400" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white text-xs">Canvas</p>
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={() => handleStartProject('paper')}
                                                    disabled={isCreatingProject}
                                                    className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-zinc-700 hover:border-violet-400 hover:bg-violet-400/5 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-10 h-10 rounded-xl bg-zinc-800 group-hover:bg-violet-400/20 flex items-center justify-center transition-colors">
                                                        {isCreatingProject ? (
                                                            <Loader2 size={18} className="text-zinc-400 animate-spin" />
                                                        ) : (
                                                            <FileText size={18} className="text-zinc-400 group-hover:text-violet-400" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white text-xs">Paper</p>
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={() => handleStartProject('notes')}
                                                    disabled={isCreatingProject}
                                                    className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-zinc-700 hover:border-amber-400 hover:bg-amber-400/5 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-10 h-10 rounded-xl bg-zinc-800 group-hover:bg-amber-400/20 flex items-center justify-center transition-colors">
                                                        {isCreatingProject ? (
                                                            <Loader2 size={18} className="text-zinc-400 animate-spin" />
                                                        ) : (
                                                            <StickyNote size={18} className="text-zinc-400 group-hover:text-amber-400" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white text-xs">Notes</p>
                                                    </div>
                                                </button>
                                            </div>

                                            {/* Divider */}
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="flex-1 h-px bg-zinc-800" />
                                                <span className="text-xs text-zinc-600 uppercase">or</span>
                                                <div className="flex-1 h-px bg-zinc-800" />
                                            </div>

                                            {/* Upload PDF */}
                                            <label className="cursor-pointer inline-block">
                                                <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleFileUpload(file);
                                                }} />
                                                <span className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-lime-400 transition-colors">
                                                    <Upload size={14} />
                                                    Upload PDF & Start
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* Canvas, Paper, or Notes Content */}
                                {(onboardingComplete || !leftPanelCollapsed || project?.pdf_url) && (
                                    <div className="h-full w-full lg:rounded-3xl overflow-hidden lg:shadow-2xl bg-white/5 pb-0">
                                        {centerMode === 'canvas' && (
                                            <InfiniteCanvas blurAmount={squintAmount} className="h-full" projectId={projectId} />
                                        )}

                                        {centerMode === 'paper' && notesLoaded && (
                                            <Notebook
                                                className="h-full"
                                                projectId={projectId}
                                                initialContent={paperContent}
                                                onSave={handleSavePaper}
                                                mode="paper"
                                                onToggleSources={() => setToolsOpen(!toolsOpen)}
                                                isSourcesOpen={toolsOpen}
                                            />
                                        )}

                                        {centerMode === 'notes' && notesLoaded && (
                                            <Notebook
                                                className="h-full"
                                                projectId={projectId}
                                                initialContent={notesContent}
                                                onSave={handleSaveNotes}
                                                mode="notes"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT PANEL - Mode-specific sidebar - Desktop only */}
                {centerMode === 'canvas' && (
                    <div className="hidden xl:block w-[280px] bg-background border-l border-zinc-800">
                        <SpecSidebar pdfUrl={project?.pdf_url ?? undefined} className="h-full" />
                    </div>
                )}

                {/* PAPER & NOTES MODE: RIGHT Position */}
                {(centerMode === 'paper' || centerMode === 'notes') && drawerPosition === 'right' && (
                    <div>
                        <SourceDrawer
                            pdfUrl={project?.pdf_url ?? undefined}
                            projectId={projectId}
                            className="bg-surface"
                            open={toolsOpen}
                            onOpenChange={setToolsOpen}
                            hideTrigger={isMobile}
                        />
                    </div>
                )}


                {/* MOBILE TOOL SWITCHER - floating bar with toggle */}
                <div className="lg:hidden absolute bottom-4 left-0 right-0 z-40 flex flex-col items-center pointer-events-none">
                    {/* Toggle Button */}
                    <button
                        onClick={() => setToolSwitcherOpen(!toolSwitcherOpen)}
                        className="mb-2 w-10 h-6 bg-zinc-800/90 backdrop-blur-sm rounded-full flex items-center justify-center pointer-events-auto border border-zinc-700 shadow-lg"
                    >
                        <ChevronRight
                            size={14}
                            className={cn(
                                "text-zinc-400 transition-transform duration-300",
                                toolSwitcherOpen ? "rotate-90" : "-rotate-90"
                            )}
                        />
                    </button>

                    {/* Tool Switcher Bar */}
                    <div className={cn(
                        "bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl p-1.5 flex justify-around pointer-events-auto shadow-xl mx-4 transition-all duration-300 ease-out",
                        toolSwitcherOpen
                            ? "opacity-100 translate-y-0 max-w-sm"
                            : "opacity-0 translate-y-4 pointer-events-none max-w-sm"
                    )}>
                        {[
                            { id: 'canvas', label: 'Canvas', icon: PenTool, color: 'text-lime-400' },
                            { id: 'paper', label: 'Paper', icon: FileText, color: 'text-violet-400' },
                            { id: 'notes', label: 'Notes', icon: StickyNote, color: 'text-amber-400' },
                            { id: 'extraction', label: 'Extract', icon: Sparkles, color: 'text-cyan-400' },
                        ].map((mode) => (
                            <button
                                key={mode.id}
                                onClick={() => setCenterMode(mode.id as 'canvas' | 'paper' | 'notes' | 'extraction')}
                                className={cn(
                                    "flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all",
                                    centerMode === mode.id
                                        ? "bg-zinc-800"
                                        : "active:bg-zinc-800/50"
                                )}
                            >
                                <mode.icon size={20} className={centerMode === mode.id ? mode.color : "text-zinc-500"} />
                                <span className={cn(
                                    "text-[9px] font-medium",
                                    centerMode === mode.id ? "text-white" : "text-zinc-500"
                                )}>{mode.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
