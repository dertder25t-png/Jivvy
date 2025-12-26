"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
    LayoutGrid,
    Search,
    Bell,
    Plus,
    PenTool,
    FileText,
    StickyNote,
    ArrowLeft,
    ChevronDown,
    Library,
    FolderOpen,
    ScanSearch,
    X,
    CalendarDays,
    Settings
} from "lucide-react";
import { JivvyAvatar } from "@/components/ui/JivvyAvatar";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/lib/store";
import { getCurrentUser, type UserInfo } from "@/app/user/actions";
import { createClient } from "@/utils/supabase/client";
import { getProject, updateProjectMetadata } from "@/app/project/actions";
import { SettingsModal } from "@/components/dashboard/SettingsModal";

// Mock project files for dropdown - in real app, fetch from database
const MOCK_PROJECT_FILES = [
    { id: "canvas", name: "Canvas", icon: PenTool, color: "text-lime-400" },
    { id: "paper", name: "Paper", icon: FileText, color: "text-violet-400" },
    { id: "notes", name: "Notes", icon: StickyNote, color: "text-amber-400" },
    { id: "extraction", name: "Extraction", icon: ScanSearch, color: "text-cyan-400" },
];

const Header = () => {
    const pathname = usePathname();
    const [searchFocused, setSearchFocused] = useState(false);
    const [user, setUser] = useState<UserInfo | null>(null);
    const [fileDropdownOpen, setFileDropdownOpen] = useState(false);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [projectTitle, setProjectTitle] = useState<string>("");
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleInputValue, setTitleInputValue] = useState("");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const libraryRef = useRef<HTMLDivElement>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);

    const { activeProjectId, centerMode, setCenterMode } = useProjectStore();

    // Fetch user on mount
    useEffect(() => {
        async function fetchUser() {
            const { user: userData } = await getCurrentUser();
            setUser(userData);
        }
        fetchUser();

        // Also listen for auth state changes
        const supabase = createClient();
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                const { user: userData } = await getCurrentUser();
                setUser(userData);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setFileDropdownOpen(false);
            }
            if (libraryRef.current && !libraryRef.current.contains(event.target as Node)) {
                setLibraryOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Fetch project title when project changes
    useEffect(() => {
        async function fetchProjectTitle() {
            if (activeProjectId && activeProjectId !== 'new') {
                const { project } = await getProject(activeProjectId);
                if (project?.title) {
                    setProjectTitle(project.title);
                    setTitleInputValue(project.title);
                }
            } else {
                setProjectTitle("");
            }
        }
        fetchProjectTitle();
    }, [activeProjectId]);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditingTitle && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [isEditingTitle]);

    // Handle title save
    const handleTitleSave = async () => {
        if (!activeProjectId || activeProjectId === 'new') return;
        if (!titleInputValue.trim()) {
            setTitleInputValue(projectTitle);
            setIsEditingTitle(false);
            return;
        }

        const { success } = await updateProjectMetadata(activeProjectId, { title: titleInputValue.trim() });
        if (success) {
            setProjectTitle(titleInputValue.trim());
        }
        setIsEditingTitle(false);
    };

    // Get greeting based on time of day
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    }, []);

    // Get user's first name
    const firstName = useMemo(() => {
        if (!user?.name) return "";
        return user.name.split(" ")[0];
    }, [user]);

    const isProjectView = pathname.startsWith("/project") && activeProjectId;

    // Current file name based on centerMode
    const currentFileName = useMemo(() => {
        const file = MOCK_PROJECT_FILES.find(f => f.id === centerMode);
        return file?.name || "Canvas";
    }, [centerMode]);

    const CurrentFileIcon = useMemo(() => {
        const file = MOCK_PROJECT_FILES.find(f => f.id === centerMode);
        return file?.icon || PenTool;
    }, [centerMode]);

    return (
        <header className="hidden md:flex h-20 items-center justify-between px-6 md:px-12 border-b border-white/5 bg-background/80 backdrop-blur-xl z-50 fixed top-0 w-full transition-transform duration-500">
            <div className="flex items-center gap-4 md:gap-8">
                {/* Logo & Greeting - Always visible */}
                <Link
                    href="/"
                    className="flex items-center gap-3 cursor-pointer group"
                >
                    <JivvyAvatar />
                    <div>
                        <h1 className="font-bold text-lg leading-none tracking-tight">
                            Jivvy
                        </h1>
                        <p className="text-xs text-zinc-500 font-medium group-hover:text-lime-400 transition-colors">
                            {user ? `${greeting}, ${firstName}` : "Welcome to Jivvy"}
                        </p>
                    </div>
                </Link>

                {/* Desktop Nav - Context Aware */}
                <nav className="hidden lg:flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded-full border border-white/5">
                    {isProjectView ? (
                        <>
                            {/* Back to Dashboard */}
                            <Link href="/">
                                <Link href="/">
                                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 text-sm font-medium transition-colors">
                                        <ArrowLeft size={16} />
                                        Dashboard
                                    </button>
                                </Link>
                            </Link>

                            {/* Divider */}
                            <div className="w-px h-6 bg-zinc-700 mx-1" />

                            {/* Editable Project Title */}
                            {projectTitle && (
                                <>
                                    {isEditingTitle ? (
                                        <input
                                            ref={titleInputRef}
                                            type="text"
                                            value={titleInputValue}
                                            onChange={(e) => setTitleInputValue(e.target.value)}
                                            onBlur={handleTitleSave}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleTitleSave();
                                                if (e.key === 'Escape') {
                                                    setTitleInputValue(projectTitle);
                                                    setIsEditingTitle(false);
                                                }
                                            }}
                                            className="bg-transparent text-white text-sm font-medium px-2 py-1 rounded border border-lime-500/50 focus:outline-none focus:border-lime-400 min-w-[120px]"
                                        />
                                    ) : (
                                        <button
                                            onClick={() => setIsEditingTitle(true)}
                                            className="text-white text-sm font-medium px-2 py-1 rounded hover:bg-zinc-800 transition-colors truncate max-w-[200px]"
                                            title="Click to rename project"
                                        >
                                            {projectTitle}
                                        </button>
                                    )}
                                    <div className="w-px h-6 bg-zinc-700 mx-1" />
                                </>
                            )}

                            {/* Project File Dropdown */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setFileDropdownOpen(!fileDropdownOpen)}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                                        fileDropdownOpen ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                                    )}
                                >
                                    <CurrentFileIcon size={16} className={
                                        centerMode === "canvas" ? "text-lime-400" :
                                            centerMode === "paper" ? "text-violet-400" :
                                                "text-amber-400"
                                    } />
                                    {currentFileName}
                                    <ChevronDown size={14} className={cn(
                                        "transition-transform",
                                        fileDropdownOpen && "rotate-180"
                                    )} />
                                </button>

                                {/* Dropdown Menu */}
                                {fileDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
                                        <div className="p-1">
                                            {MOCK_PROJECT_FILES.map((file) => (
                                                <button
                                                    key={file.id}
                                                    onClick={() => {
                                                        setCenterMode(file.id as "canvas" | "paper" | "notes" | "extraction");
                                                        setFileDropdownOpen(false);
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                                                        centerMode === file.id
                                                            ? "bg-zinc-800 text-white"
                                                            : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                                                    )}
                                                >
                                                    <file.icon size={16} className={file.color} />
                                                    <span className="font-medium text-sm">{file.name}</span>
                                                    {centerMode === file.id && (
                                                        <span className="ml-auto w-2 h-2 rounded-full bg-lime-400" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="w-px h-6 bg-zinc-700 mx-1" />

                            {/* Library Button */}
                            <div className="relative" ref={libraryRef}>
                                <button
                                    onClick={() => setLibraryOpen(!libraryOpen)}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                                        libraryOpen ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-white hover:bg-zinc-800/50"
                                    )}
                                >
                                    <Library size={16} />
                                    Library
                                </button>

                                {/* Library Dropdown */}
                                {libraryOpen && (
                                    <div className="absolute top-full left-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
                                        <div className="p-3 border-b border-zinc-800">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Quick Access</span>
                                                <button
                                                    onClick={() => setLibraryOpen(false)}
                                                    className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-2">
                                            <Link href="/" onClick={() => setLibraryOpen(false)}>
                                                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors">
                                                    <LayoutGrid size={16} className="text-lime-400" />
                                                    <span className="font-medium text-sm">All Projects</span>
                                                </div>
                                            </Link>
                                            <Link href="/calendar" onClick={() => setLibraryOpen(false)}>
                                                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors">
                                                    <CalendarDays size={16} className="text-amber-400" />
                                                    <span className="font-medium text-sm">Calendar</span>
                                                </div>
                                            </Link>
                                            <Link href="/project/new" onClick={() => setLibraryOpen(false)}>
                                                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors">
                                                    <FolderOpen size={16} className="text-violet-400" />
                                                    <span className="font-medium text-sm">New Project</span>
                                                </div>
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Dashboard Nav - Dashboard + Calendar */
                        <>
                            <Link href="/">
                                <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-colors shadow-lg shadow-lime-400/10">
                                    <LayoutGrid size={18} className="text-lime-400" />
                                    Dashboard
                                </button>
                            </Link>
                            <Link href="/calendar">
                                <button className="flex items-center gap-2 px-3 py-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/50 text-sm font-medium transition-colors">
                                    <CalendarDays size={18} className="text-amber-400" />
                                    Calendar
                                </button>
                            </Link>
                        </>
                    )}
                </nav>
            </div>

            <div className="flex items-center gap-3 md:gap-4">
                <div
                    className={cn(
                        "hidden md:flex items-center bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 gap-3 w-64 transition-all duration-300",
                        searchFocused ? "ring-2 ring-lime-400/50 w-80" : "hover:border-zinc-700"
                    )}
                >
                    <Search size={18} className="text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="bg-transparent border-none outline-none text-white placeholder-zinc-500 w-full text-sm"
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                    />
                </div>
                <button className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 transition-colors relative">
                    <Bell size={18} className="text-zinc-400" />
                    <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                </button>
                <button
                    onClick={() => setSettingsOpen(true)}
                    className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 transition-colors"
                >
                    <Settings size={18} className="text-zinc-400" />
                </button>
                <Link href="/project/new">
                    <button className="flex items-center gap-2 px-4 py-2 bg-lime-400 hover:bg-lime-300 text-black rounded-full font-bold shadow-[0_0_20px_rgba(163,230,53,0.3)] transition-colors">
                        <Plus size={18} /> <span className="hidden md:inline">New</span>
                    </button>
                </Link>
            </div>

            <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
        </header>
    );
};

export { Header };
