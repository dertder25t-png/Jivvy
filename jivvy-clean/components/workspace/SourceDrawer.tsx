"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    BookOpen,
    Link2,
    FileText,
    GripVertical,
    Plus,
    ExternalLink,
    ChevronRight,
    X,
    Quote,
    StickyNote,
    CreditCard,
    ChevronDown,
    ChevronUp,
    Download,
    Copy,
    Edit2,
    Trash2,
    Check,
    Upload,
    Eye,
    EyeOff,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
// import { AICommandCenter } from './AICommandCenter'; // Commented out missing component
// import { FlashcardSidebar } from "./FlashcardSidebar"; // Commented out missing component
// import { SyllabusTracker } from "./SyllabusTracker"; // Commented out missing component
// import { useSettingsStore } from "@/lib/store/settings"; // Commented out missing component
import { db, Citation } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import {
    type CitationStyle,
    formatInlineCitation,
    exportBibliography,
    copyToClipboard,
    downloadAsFile,
    formatCitation
} from "@/lib/citation-formatter";

interface SourceDrawerProps {
    className?: string;
    pdfUrl?: string;
    projectId?: string;
    orientation?: 'vertical' | 'horizontal'; // Prop to force orientation if needed
}

export function SourceDrawer({ className, pdfUrl, projectId, orientation: propOrientation }: SourceDrawerProps) {
    const [activeTab, setActiveTab] = useState<"sources" | "pdf" | "research" | "flashcards" | "notes">("sources");

    // Use Dexie Live Query
    const citations = useLiveQuery(
        () => projectId ? db.citations.where('project_id').equals(projectId).toArray() : [],
        [projectId]
    ) || [];

    const [isAddingCitation, setIsAddingCitation] = useState(false);
    const [editingCitation, setEditingCitation] = useState<Citation | null>(null);
    const [citationStyle, setCitationStyle] = useState<CitationStyle>('APA');
    const [showStyleMenu, setShowStyleMenu] = useState(false);
    const [copySuccess, setCopySuccess] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    // PDF State
    const [pdfCollapsed, setPdfCollapsed] = useState(false);
    const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
    const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(null);
    const [localFileName, setLocalFileName] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const activePdfUrl = localPdfUrl || pdfUrl;

    const handleLocalFile = useCallback((file: File) => {
        if (!file.type.includes('pdf')) return;
        setUploading(true);
        const blobUrl = URL.createObjectURL(file);
        setLocalPdfUrl(blobUrl);
        setLocalFileName(file.name);
        setUploading(false);
    }, []);

    const handleLocalDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleLocalFile(file);
    }, [handleLocalFile]);

    const handleClearLocalPdf = useCallback(() => {
        if (localPdfUrl) URL.revokeObjectURL(localPdfUrl);
        setLocalPdfUrl(null);
        setLocalFileName(null);
    }, [localPdfUrl]);

    // Citation Form Data
    const [formData, setFormData] = useState<Partial<Citation>>({
        type: 'article',
        title: '',
        author: ''
    });

    const orientation = propOrientation || 'vertical';

    const handleDragStart = (e: React.DragEvent, citation: Citation) => {
        const citationText = formatInlineCitation(citation, citationStyle);
        e.dataTransfer.setData("text/plain", citationText);
        e.dataTransfer.setData("application/json", JSON.stringify(citation));
    };

    const handleAddCitation = async () => {
        if (!formData.title?.trim() || !formData.author?.trim() || !projectId) return;

        try {
            await db.citations.add({
                ...formData as any, // Cast to any to bypass strict type checks for optional fields
                project_id: projectId,
                id: crypto.randomUUID(),
                created_at: Date.now(),
                updated_at: Date.now(),
                sync_status: 'dirty'
            } as Citation);
            setIsAddingCitation(false);
            resetForm();
        } catch (error) {
            console.error("Failed to add citation:", error);
        }
    };

    const handleEditCitation = async () => {
        if (!editingCitation || !projectId) return;
        try {
            await db.citations.update(editingCitation.id, {
                ...formData,
                updated_at: Date.now(),
                sync_status: 'dirty'
            });
            setEditingCitation(null);
            resetForm();
        } catch (error) {
            console.error("Failed to update citation:", error);
        }
    };

    const handleDeleteCitation = async (id: string) => {
        if (confirm('Delete this citation?')) {
            await db.citations.delete(id);
        }
    };

    const resetForm = () => {
        setFormData({ type: 'article', title: '', author: '' });
    };

    const startEdit = (citation: Citation) => {
        setEditingCitation(citation);
        setFormData(citation);
    };

    const handleCopyCitation = async (citation: Citation) => {
        const formatted = formatCitation(citation, citationStyle);
        const success = await copyToClipboard(formatted);
        if (success) {
            setCopySuccess(citation.id);
            setTimeout(() => setCopySuccess(null), 2000);
        }
    };

    const handleExportBibliography = async () => {
        const bibliography = exportBibliography(citations, citationStyle);
        const success = await copyToClipboard(bibliography);
        if (success) {
            setCopySuccess('all');
            setTimeout(() => setCopySuccess(null), 2000);
        }
    };

    const handleDownloadBibliography = () => {
        const bibliography = exportBibliography(citations, citationStyle);
        downloadAsFile(bibliography, `bibliography-${citationStyle.toLowerCase()}.txt`);
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "book": return <BookOpen size={14} />;
            case "article": return <FileText size={14} />;
            case "website": return <Link2 size={14} />;
            default: return <Quote size={14} />;
        }
    };

    const isHorizontal = orientation === 'horizontal';

    if (collapsed) {
        return (
            <button
                onClick={() => setCollapsed(false)}
                className={cn(
                    "flex items-center justify-center bg-surface hover:bg-zinc-900 transition-colors group z-20",
                    isHorizontal ? "w-full h-8 border-t border-zinc-800" : "h-full w-10 border-l border-zinc-800"
                )}
            >
                {isHorizontal ? (
                    <span className="flex items-center gap-2 text-xs text-zinc-500 group-hover:text-violet-400">
                        <ChevronUp size={14} /> Open Drawer
                    </span>
                ) : (
                    <ChevronRight size={16} className="text-zinc-500 group-hover:text-violet-400 rotate-180" />
                )}
            </button>
        );
    }

    return (
        <div className={cn(
            "flex bg-surface border-zinc-800 overflow-hidden relative transition-all duration-300",
            isHorizontal ? "w-full h-80 flex-col border-t" : "w-96 h-full flex-col border-l",
            className
        )}>
            {/* Header */}
            <div className={cn("flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-surface z-10")}>
                <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab("sources")}
                        className={cn("px-3 py-1.5 rounded-md text-xs font-medium", activeTab === "sources" ? "bg-violet-500/20 text-violet-400" : "text-zinc-500")}
                    >
                        Sources
                    </button>
                    <button
                        onClick={() => setActiveTab("pdf")}
                        className={cn("px-3 py-1.5 rounded-md text-xs font-medium", activeTab === "pdf" ? "bg-violet-500/20 text-violet-400" : "text-zinc-500")}
                    >
                        PDF
                    </button>
                </div>
                <button onClick={() => setCollapsed(true)} className="p-1.5 hover:bg-zinc-800 rounded">
                    {isHorizontal ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                {activeTab === "sources" ? (
                    <div className="h-full flex flex-col">
                        <div className="p-3 border-b border-zinc-800 flex gap-2">
                            <button
                                onClick={() => setIsAddingCitation(true)}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium"
                            >
                                <Plus size={14} /> Add Source
                            </button>
                            <button onClick={handleExportBibliography} className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white">
                                <Copy size={14} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {citations.map((citation) => (
                                <div key={citation.id} draggable onDragStart={(e) => handleDragStart(e, citation)} className="group flex items-start gap-2 p-3 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl cursor-grab border border-transparent hover:border-violet-500/30">
                                    <GripVertical size={14} className="mt-0.5 text-zinc-600" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 text-xs text-violet-400 uppercase">
                                            {getTypeIcon(citation.type)} {citation.type}
                                        </div>
                                        <h4 className="text-sm font-medium text-white truncate">{citation.title}</h4>
                                        <p className="text-xs text-zinc-500 mt-0.5">{citation.author}</p>
                                    </div>
                                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100">
                                        <button onClick={() => handleCopyCitation(citation)} className="p-1 hover:text-violet-400"><Copy size={12} /></button>
                                        <button onClick={() => startEdit(citation)} className="p-1 hover:text-violet-400"><Edit2 size={12} /></button>
                                        <button onClick={() => handleDeleteCitation(citation.id)} className="p-1 hover:text-red-400"><Trash2 size={12} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col">
                        {activePdfUrl ? (
                            <iframe src={activePdfUrl} className="w-full h-full border-0" title="PDF" />
                        ) : (
                            <div
                                className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-zinc-700 m-4 rounded-xl cursor-pointer hover:border-zinc-500"
                                onClick={() => fileInputRef.current?.click()}
                                onDrop={handleLocalDrop}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                            >
                                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleLocalFile(e.target.files[0])} />
                                <Upload size={24} className="text-zinc-500 mb-2" />
                                <p className="text-zinc-500 text-xs">Drop PDF here</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {(isAddingCitation || editingCitation) && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 w-full max-w-sm space-y-3">
                        <h3 className="text-white font-bold">{editingCitation ? 'Edit' : 'Add'} Citation</h3>
                        <input
                            placeholder="Title"
                            className="w-full bg-zinc-800 border-zinc-700 rounded px-3 py-2 text-sm text-white"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                        />
                        <input
                            placeholder="Author"
                            className="w-full bg-zinc-800 border-zinc-700 rounded px-3 py-2 text-sm text-white"
                            value={formData.author}
                            onChange={e => setFormData({ ...formData, author: e.target.value })}
                        />
                        <div className="flex gap-2 justify-end mt-2">
                            <button onClick={() => { setIsAddingCitation(false); setEditingCitation(null); }} className="px-3 py-1.5 text-zinc-400 text-xs">Cancel</button>
                            <button onClick={editingCitation ? handleEditCitation : handleAddCitation} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
