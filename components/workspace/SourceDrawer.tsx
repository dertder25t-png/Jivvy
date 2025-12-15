"use client";

import React, { useState, useEffect } from "react";
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
    Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ResearchTools } from './ResearchTools';
import { useProjectStore } from "@/lib/store";
import { FlashcardSidebar } from "./FlashcardSidebar"; // Ensure this matches import path
// Identifying SyllabusTracker as the "Notes" component
import { SyllabusTracker } from "./SyllabusTracker";
import { useSettingsStore } from "@/lib/store/settings";
import { 
    type Citation, 
    type CitationStyle, 
    formatInlineCitation, 
    exportBibliography, 
    copyToClipboard, 
    downloadAsFile,
    formatCitation
} from "@/utils/citation-formatter";

interface SourceDrawerProps {
    className?: string;
    pdfUrl?: string;
    projectId?: string;
    orientation?: 'vertical' | 'horizontal'; // Prop to force orientation if needed
}

// Mock citations for demo - in real app, fetch from database
const MOCK_CITATIONS: Citation[] = [
    {
        id: "1",
        title: "Design Principles and Problems",
        author: "Paul Zelanski",
        type: "book",
        page: "42-48"
    },
    {
        id: "2",
        title: "The Elements of Typographic Style",
        author: "Robert Bringhurst",
        type: "book",
        page: "23"
    },
    {
        id: "3",
        title: "Interaction of Color",
        author: "Josef Albers",
        type: "book",
        page: "112-115"
    },
];

export function SourceDrawer({ className, pdfUrl, projectId, orientation: propOrientation }: SourceDrawerProps) {
    // Default to 'sources' or previously checked? Let's default to sources.
    const [activeTab, setActiveTab] = useState<"sources" | "pdf" | "research" | "flashcards" | "notes">("sources");
    const [citations, setCitations] = useState<Citation[]>(MOCK_CITATIONS);
    const [isAddingCitation, setIsAddingCitation] = useState(false);
    const [editingCitation, setEditingCitation] = useState<Citation | null>(null);
    const [citationStyle, setCitationStyle] = useState<CitationStyle>('APA');
    const [showStyleMenu, setShowStyleMenu] = useState(false);
    const [copySuccess, setCopySuccess] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
    const { setPdfPage } = useProjectStore();
    
    // Citation form state
    const [formData, setFormData] = useState({
        title: '',
        author: '',
        type: 'article' as Citation['type'],
        url: '',
        page: '',
        year: '',
        publisher: '',
        journal: '',
        volume: '',
        issue: '',
        doi: ''
    });

    // Subscribe to store setting, but allow prop override
    const storePosition = useSettingsStore(state => state.drawerPosition);
    // If prop is provided (e.g. wrapper dictates), usage that. Otherwise store.
    // 'vertical' maps to 'right' position, 'horizontal' maps to 'bottom'.
    const orientation = propOrientation ?? (storePosition === 'bottom' ? 'horizontal' : 'vertical');

    useEffect(() => {
        if (pdfUrl) {
            fetch(pdfUrl)
                .then(res => res.arrayBuffer())
                .then(buf => setPdfBuffer(buf))
                .catch(err => console.error("Failed to load PDF buffer:", err));
        }
    }, [pdfUrl]);

    const handleDragStart = (e: React.DragEvent, citation: Citation) => {
        // Format citation for drag & drop into paper using selected style
        const citationText = formatInlineCitation(citation, citationStyle);
        e.dataTransfer.setData("text/plain", citationText);
        e.dataTransfer.setData("application/json", JSON.stringify(citation));
    };
    
    const handleAddCitation = () => {
        if (!formData.title.trim() || !formData.author.trim()) {
            return;
        }
        
        const newCitation: Citation = {
            id: Date.now().toString(),
            title: formData.title,
            author: formData.author,
            type: formData.type,
            url: formData.url || undefined,
            page: formData.page || undefined,
            year: formData.year || undefined,
            publisher: formData.publisher || undefined,
            journal: formData.journal || undefined,
            volume: formData.volume || undefined,
            issue: formData.issue || undefined,
            doi: formData.doi || undefined
        };
        
        setCitations(prev => [...prev, newCitation]);
        setIsAddingCitation(false);
        resetForm();
    };
    
    const handleEditCitation = () => {
        if (!editingCitation || !formData.title.trim() || !formData.author.trim()) {
            return;
        }
        
        setCitations(prev => prev.map(c => 
            c.id === editingCitation.id 
                ? { ...c, ...formData, id: c.id }
                : c
        ));
        setEditingCitation(null);
        resetForm();
    };
    
    const handleDeleteCitation = (id: string) => {
        setCitations(prev => prev.filter(c => c.id !== id));
    };
    
    const resetForm = () => {
        setFormData({
            title: '',
            author: '',
            type: 'article',
            url: '',
            page: '',
            year: '',
            publisher: '',
            journal: '',
            volume: '',
            issue: '',
            doi: ''
        });
    };
    
    const startEdit = (citation: Citation) => {
        setEditingCitation(citation);
        setFormData({
            title: citation.title,
            author: citation.author,
            type: citation.type,
            url: citation.url || '',
            page: citation.page || '',
            year: citation.year || '',
            publisher: citation.publisher || '',
            journal: citation.journal || '',
            volume: citation.volume || '',
            issue: citation.issue || '',
            doi: citation.doi || ''
        });
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

    const getTypeIcon = (type: Citation["type"]) => {
        switch (type) {
            case "book":
                return <BookOpen size={14} />;
            case "article":
                return <FileText size={14} />;
            case "website":
                return <Link2 size={14} />;
            case "pdf":
                return <FileText size={14} />;
            default:
                return <Quote size={14} />;
        }
    };

    const isHorizontal = orientation === 'horizontal';

    if (collapsed) {
        return (
            <button
                onClick={() => setCollapsed(false)}
                className={cn(
                    "flex items-center justify-center bg-surface hover:bg-zinc-900 transition-colors group z-20",
                    isHorizontal
                        ? "w-full h-8 border-t border-zinc-800"
                        : "h-full w-10 border-l border-zinc-800"
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
            isHorizontal
                ? "w-full h-80 flex-col border-t"
                : "w-96 h-full flex-col border-l", // Increased width slightly for better content fit
            className
        )}>
            {/* Header with Tabs */}
            <div className={cn(
                "flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-surface z-10",
                isHorizontal && "sticky top-0"
            )}>
                <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg overflow-x-auto no-scrollbar max-w-[calc(100%-40px)]">
                    {[
                        { id: 'sources', label: 'Sources', icon: BookOpen },
                        { id: 'pdf', label: 'PDF View', icon: FileText },
                        { id: 'research', label: 'Tools', icon: Link2 }, // Shortened for space
                        { id: 'flashcards', label: 'Flashcards', icon: CreditCard },
                        { id: 'notes', label: 'Notes', icon: StickyNote },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as "sources" | "pdf" | "research" | "flashcards" | "notes")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                                activeTab === tab.id
                                    ? "bg-violet-500/20 text-violet-400 shadow-sm"
                                    : "text-zinc-500 hover:text-white"
                            )}
                        >
                            {/* {tab.label} */}
                            {/* Condense label on vertical if needed, but horizontal usually has space. */}
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-1">
                    {/* Position Toggle (Just for quick access if desired, or rely on Settings) */}
                    {/* For now, just collapse button */}
                    <button
                        onClick={() => setCollapsed(true)}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                    >
                        {isHorizontal ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === "research" ? (
                    <ResearchTools
                        pdfBuffer={pdfBuffer}
                        onJumpToPage={(page) => {
                            setPdfPage(page);
                        }}
                    />
                ) : activeTab === "flashcards" ? (
                    <div className="h-full overflow-hidden">
                        <FlashcardSidebar projectId={projectId} />
                    </div>
                ) : activeTab === "notes" ? (
                    <div className="h-full overflow-hidden">
                        <SyllabusTracker projectId={projectId} />
                    </div>
                ) : activeTab === "sources" ? (
                    <div className="h-full flex flex-col">
                        {/* Citation Controls */}
                        <div className="p-3 border-b border-zinc-800 space-y-2">
                            {/* Style Selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500">Style:</span>
                                <div className="relative flex-1">
                                    <button
                                        onClick={() => setShowStyleMenu(!showStyleMenu)}
                                        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors text-xs font-medium"
                                    >
                                        {citationStyle}
                                        <ChevronDown size={12} />
                                    </button>
                                    {showStyleMenu && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden z-20 shadow-xl">
                                            {(['APA', 'MLA', 'Chicago'] as CitationStyle[]).map(style => (
                                                <button
                                                    key={style}
                                                    onClick={() => {
                                                        setCitationStyle(style);
                                                        setShowStyleMenu(false);
                                                    }}
                                                    className={cn(
                                                        "w-full px-3 py-2 text-xs text-left hover:bg-zinc-700 transition-colors",
                                                        citationStyle === style ? "text-violet-400 bg-zinc-700/50" : "text-zinc-300"
                                                    )}
                                                >
                                                    {style}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsAddingCitation(true)}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-lg transition-colors text-xs font-medium"
                                >
                                    <Plus size={14} />
                                    Add
                                </button>
                                <button
                                    onClick={handleExportBibliography}
                                    disabled={citations.length === 0}
                                    className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Copy all citations"
                                >
                                    {copySuccess === 'all' ? <Check size={14} className="text-lime-400" /> : <Copy size={14} />}
                                </button>
                                <button
                                    onClick={handleDownloadBibliography}
                                    disabled={citations.length === 0}
                                    className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Download bibliography"
                                >
                                    <Download size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Citations List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {citations.length === 0 ? (
                                <div className="text-center py-8">
                                    <Quote className="mx-auto text-zinc-700 mb-3" size={24} />
                                    <p className="text-zinc-500 text-sm">No sources yet</p>
                                    <p className="text-zinc-600 text-xs mt-1">Add citations to reference in your paper</p>
                                </div>
                            ) : (
                                citations.map((citation) => (
                                    <div
                                        key={citation.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, citation)}
                                        className="group flex items-start gap-2 p-3 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl cursor-grab active:cursor-grabbing transition-colors border border-transparent hover:border-violet-500/30"
                                    >
                                        <div className="mt-0.5 text-zinc-600 group-hover:text-violet-400 transition-colors">
                                            <GripVertical size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-violet-400">
                                                    {getTypeIcon(citation.type)}
                                                </span>
                                                <span className="text-xs text-zinc-500 uppercase">{citation.type}</span>
                                            </div>
                                            <h4 className="text-sm font-medium text-white truncate">
                                                {citation.title}
                                            </h4>
                                            <p className="text-xs text-zinc-500 mt-0.5">
                                                {citation.author}
                                                {citation.year && <span className="text-zinc-600"> ({citation.year})</span>}
                                                {citation.page && <span className="text-violet-400"> • p. {citation.page}</span>}
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCopyCitation(citation);
                                                }}
                                                className="p-1 text-zinc-600 hover:text-violet-400 transition-colors"
                                                title="Copy formatted citation"
                                            >
                                                {copySuccess === citation.id ? <Check size={12} className="text-lime-400" /> : <Copy size={12} />}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    startEdit(citation);
                                                }}
                                                className="p-1 text-zinc-600 hover:text-violet-400 transition-colors"
                                                title="Edit citation"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('Delete this citation?')) {
                                                        handleDeleteCitation(citation.id);
                                                    }
                                                }}
                                                className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                                                title="Delete citation"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                            {citation.url && (
                                                <a
                                                    href={citation.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1 text-zinc-600 hover:text-violet-400 transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                    title="Open URL"
                                                >
                                                    <ExternalLink size={12} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Drag Hint */}
                        <div className="p-2 border-t border-zinc-800 bg-zinc-900/30">
                            <p className="text-[10px] text-zinc-600 text-center uppercase tracking-wider">
                                Drag to Insert
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col">
                        {pdfUrl ? (
                            <iframe
                                src={pdfUrl}
                                className="w-full h-full border-0"
                                title="Reference PDF"
                            />
                        ) : (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center py-8 px-4">
                                    <FileText className="mx-auto text-zinc-700 mb-3" size={32} />
                                    <p className="text-zinc-500 text-sm">No PDF attached</p>
                                    <p className="text-zinc-600 text-xs mt-1">Upload a PDF to view it here</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Add/Edit Citation Modal */}
            {(isAddingCitation || editingCitation) && (
                <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 w-full max-w-md shadow-2xl my-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-white">
                                {editingCitation ? 'Edit Citation' : 'Add Citation'}
                            </h3>
                            <button
                                onClick={() => {
                                    setIsAddingCitation(false);
                                    setEditingCitation(null);
                                    resetForm();
                                }}
                                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                            {/* Required Fields */}
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Title *</label>
                                <input
                                    type="text"
                                    placeholder="Enter title"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Author *</label>
                                <input
                                    type="text"
                                    placeholder="Last, First M."
                                    value={formData.author}
                                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Type *</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value as Citation['type'] })}
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                                >
                                    <option value="article">Article</option>
                                    <option value="book">Book</option>
                                    <option value="website">Website</option>
                                    <option value="pdf">PDF</option>
                                </select>
                            </div>
                            
                            {/* Optional Fields */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1">Year</label>
                                    <input
                                        type="text"
                                        placeholder="2024"
                                        value={formData.year}
                                        onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1">Page(s)</label>
                                    <input
                                        type="text"
                                        placeholder="12-15"
                                        value={formData.page}
                                        onChange={(e) => setFormData({ ...formData, page: e.target.value })}
                                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                                    />
                                </div>
                            </div>
                            
                            {(formData.type === 'article' || formData.type === 'pdf') && (
                                <>
                                    <div>
                                        <label className="block text-xs text-zinc-400 mb-1">Journal</label>
                                        <input
                                            type="text"
                                            placeholder="Journal name"
                                            value={formData.journal}
                                            onChange={(e) => setFormData({ ...formData, journal: e.target.value })}
                                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-zinc-400 mb-1">Volume</label>
                                            <input
                                                type="text"
                                                placeholder="12"
                                                value={formData.volume}
                                                onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-zinc-400 mb-1">Issue</label>
                                            <input
                                                type="text"
                                                placeholder="3"
                                                value={formData.issue}
                                                onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
                                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            {formData.type === 'book' && (
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1">Publisher</label>
                                    <input
                                        type="text"
                                        placeholder="Publisher name"
                                        value={formData.publisher}
                                        onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                                    />
                                </div>
                            )}
                            
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">URL</label>
                                <input
                                    type="url"
                                    placeholder="https://..."
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">DOI</label>
                                <input
                                    type="text"
                                    placeholder="10.1234/example"
                                    value={formData.doi}
                                    onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                                />
                            </div>
                        </div>
                        
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={() => {
                                    setIsAddingCitation(false);
                                    setEditingCitation(null);
                                    resetForm();
                                }}
                                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={editingCitation ? handleEditCitation : handleAddCitation}
                                disabled={!formData.title.trim() || !formData.author.trim()}
                                className="flex-1 py-2.5 bg-violet-500 hover:bg-violet-400 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {editingCitation ? 'Save Changes' : 'Add Citation'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
