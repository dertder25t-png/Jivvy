"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
    Upload, FileText, Loader2, Eye, PenTool, StickyNote,
    ChevronLeft, ChevronRight, Sparkles,
    Maximize2, SplitSquareHorizontal
} from "lucide-react";
import { getProject, createProject, type Project } from "../actions";
import { uploadPDF } from "@/utils/supabase/storage";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { SpecSidebar } from "@/components/workspace/SpecSidebar";
import { DesignDoctorTool } from "@/components/workspace/DesignDoctorTool";

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

type CenterPanelMode = "canvas" | "notebook";

// Mock spec items for the properties panel
export default function ProjectPage() {
    const params = useParams();
    const projectId = params.id as string;

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [centerMode, setCenterMode] = useState<CenterPanelMode>("canvas");
    const [squintAmount, setSquintAmount] = useState(0);
    const [onboardingComplete, setOnboardingComplete] = useState(false);

    // Collapse left panel if no PDF
    useEffect(() => {
        if (!project?.pdf_url) {
            setLeftPanelCollapsed(true);
        }
    }, [project]);

    // Fetch project data
    useEffect(() => {
        async function fetchProject() {
            if (projectId === 'new') {
                setLoading(false);
                return;
            }
            const { project: data, error } = await getProject(projectId);
            if (!error && data) {
                setProject(data);
                setLeftPanelCollapsed(false);
            }
            setLoading(false);
        }
        fetchProject();
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

    const toggleSpec = (id: string) => { };

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[#1a1a1d]">
                <Loader2 className="animate-spin text-lime-400" size={32} />
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-[#121212] fixed inset-0 top-20">

            {/* LEFT PANEL - PDF Viewer (Collapsible) */}
            <div className={cn(
                "h-full flex flex-col border-r border-zinc-800 bg-[#121212] transition-all duration-300",
                leftPanelCollapsed ? "w-0" : "w-[320px] min-w-[320px]"
            )}>
                {!leftPanelCollapsed && (
                    <>
                        {/* Panel Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Design Brief</span>
                            <button
                                onClick={() => setLeftPanelCollapsed(true)}
                                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                        </div>

                        {/* PDF Content or Empty State */}
                        <div className="flex-1 overflow-hidden p-3">
                            {project?.pdf_url ? (
                                <PDFViewer url={project.pdf_url} className="h-full w-full rounded-xl" />
                            ) : (
                                <div
                                    className={cn(
                                        "h-full w-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all",
                                        dragOver ? 'border-lime-400 bg-lime-400/10' : 'border-zinc-700 hover:border-zinc-600'
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
                                            <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 flex items-center justify-center mb-4">
                                                <FileText className="text-lime-400" size={24} />
                                            </div>
                                            <p className="text-zinc-400 text-sm mb-3">Drop PDF here</p>
                                            <label className="cursor-pointer">
                                                <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleFileUpload(file);
                                                }} />
                                                <span className="text-xs text-lime-400 hover:underline">or browse</span>
                                            </label>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Collapsed Left Toggle */}
            {leftPanelCollapsed && (
                <button
                    onClick={() => setLeftPanelCollapsed(false)}
                    className="h-full w-10 flex items-center justify-center bg-[#121212] border-r border-zinc-800 hover:bg-zinc-900 transition-colors group"
                >
                    <ChevronRight size={16} className="text-zinc-500 group-hover:text-lime-400" />
                </button>
            )}

            {/* CENTER PANEL - Canvas or Notebook */}
            <div className="flex-1 h-full flex flex-col overflow-hidden relative">

                {/* Floating Tabs (More distinct, spread apart) */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 bg-zinc-900/90 backdrop-blur-xl p-1.5 rounded-full border border-zinc-700/50 shadow-2xl">
                    <button
                        onClick={() => setCenterMode("canvas")}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold transition-all duration-300",
                            centerMode === 'canvas'
                                ? "bg-lime-400 text-black shadow-[0_0_20px_rgba(163,230,53,0.3)] scale-105"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <PenTool size={16} />
                        Canvas
                    </button>
                    <button
                        onClick={() => setCenterMode("notebook")}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold transition-all duration-300",
                            centerMode === 'notebook'
                                ? "bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] scale-105"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <StickyNote size={16} />
                        Notebook
                    </button>
                </div>

                {/* Squint Slider (Floating) */}
                {centerMode === 'canvas' && (
                    <div className="absolute bottom-6 left-6 z-20 flex items-center gap-3 bg-zinc-900/90 backdrop-blur-xl p-3 rounded-2xl border border-zinc-800 shadow-xl">
                        <Eye size={16} className="text-zinc-400" />
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Squint Test</span>
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

                {/* CANVAS AREA - Mid-Grey Background with Breathing Room */}
                <div
                    className="flex-1 overflow-hidden p-6 bg-[#1a1a1d] relative"
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                >
                    {/* Design Doctor Floating Tool (Only visible in Canvas mode or always accessible) */}
                    <DesignDoctorTool />
                    {/* Full-Screen Onboarding Overlay */}
                    {!project?.pdf_url && leftPanelCollapsed && !onboardingComplete && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#121212]/95 backdrop-blur-sm">
                            <div
                                className={cn(
                                    "bg-zinc-900 rounded-3xl border border-zinc-800 p-8 text-center max-w-md shadow-2xl",
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
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <button
                                        onClick={() => { setCenterMode('canvas'); setLeftPanelCollapsed(false); setOnboardingComplete(true); }}
                                        className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-zinc-700 hover:border-lime-400 hover:bg-lime-400/5 transition-all group"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-zinc-800 group-hover:bg-lime-400/20 flex items-center justify-center transition-colors">
                                            <PenTool size={20} className="text-zinc-400 group-hover:text-lime-400" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm">Canvas</p>
                                            <p className="text-[10px] text-zinc-500">Moodboards & Design</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => { setCenterMode('notebook'); setLeftPanelCollapsed(false); setOnboardingComplete(true); }}
                                        className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-zinc-700 hover:border-violet-400 hover:bg-violet-400/5 transition-all group"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-zinc-800 group-hover:bg-violet-400/20 flex items-center justify-center transition-colors">
                                            <StickyNote size={20} className="text-zinc-400 group-hover:text-violet-400" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm">Notes</p>
                                            <p className="text-[10px] text-zinc-500">Research & Writing</p>
                                        </div>
                                    </button>
                                </div>

                                {/* Divider */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex-1 h-px bg-zinc-800" />
                                    <span className="text-[10px] text-zinc-600 uppercase">or</span>
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
                                        Upload a Design Brief (PDF)
                                    </span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Canvas or Notebook Content - only show when not in onboarding */}
                    {(onboardingComplete || !leftPanelCollapsed || project?.pdf_url) && (
                        <div className="h-full w-full rounded-xl overflow-hidden shadow-2xl bg-white/5">
                            {centerMode === 'canvas' ? (
                                <InfiniteCanvas blurAmount={squintAmount} className="h-full" projectId={projectId} />
                            ) : (
                                <Notebook className="h-full" projectId={projectId} />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT PANEL - Spec Sidebar with AI Extraction */}
            <SpecSidebar pdfUrl={project?.pdf_url} />
        </div>
    );
}
