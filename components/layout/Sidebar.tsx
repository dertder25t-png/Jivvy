
"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Project } from "@/lib/db";
import { useRouter, usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import {
    Inbox,
    Calendar,
    CalendarDays,
    Trash2,
    Settings,
    ChevronDown,
    ChevronRight,
    Plus,
    Hash,
    MessageSquare,
    Zap,
    X,
    Edit2,
    LogOut
} from "lucide-react";
import { cn, getRandomPaletteColor, PASTEL_PALETTE } from "@/lib/utils";
import { CalendarSettings } from "@/components/settings/CalendarSettings";
import { useAuth } from "@/components/providers/AuthProvider";
import { SyncSettings } from "@/components/settings/SyncSettings";

interface SidebarItemProps {
    icon?: React.ElementType;
    label: string;
    count?: number | string;
    active?: boolean;
    onClick?: () => void;
    rightElement?: React.ReactNode;
}

// Sidebar Item Component
const SidebarItem = ({
    icon: Icon,
    label,
    count,
    active,
    onClick,
    rightElement
}: SidebarItemProps) => (
    <div
        role="button"
        onClick={onClick}
        className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors group relative cursor-pointer select-none",
            active
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 font-medium"
                : "text-text-secondary hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-text-primary"
        )}
    >
        {Icon && <Icon className={cn("w-4 h-4", active ? "text-blue-600 dark:text-blue-400" : "text-zinc-500")} />}
        <span className="flex-1 text-left truncate">{label}</span>
        {count && <span className="text-xs opacity-60 group-hover:hidden">{count}</span>}
        {rightElement && <div className="hidden group-hover:block ml-auto">{rightElement}</div>}
    </div>
);

// Recursive Project Item Component
const ProjectTreeItem = ({
    project,
    allProjects,
    activeId,
    depth = 0,
    onNavigate,
    onDelete
}: {
    project: Project,
    allProjects: Project[],
    activeId: string,
    depth?: number,
    onNavigate: (id: string) => void,
    onDelete: (id: string, e: React.MouseEvent) => void
}) => {
    const children = allProjects.filter(p => p.parent_project_id === project.id);
    const hasChildren = children.length > 0;
    const [expanded, setExpanded] = useState(true);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(project.title);
    const [showPalette, setShowPalette] = useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (isRenaming && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isRenaming]);

    const handleRenameSubmit = async () => {
        if (renameValue.trim() && renameValue !== project.title) {
            await db.projects.update(project.id, {
                title: renameValue,
                updated_at: Date.now(),
                sync_status: 'dirty'
            });
        }
        setIsRenaming(false);
    };

    const handleColorChange = async (color: string) => {
        await db.projects.update(project.id, {
            color,
            updated_at: Date.now(),
            sync_status: 'dirty'
        });
        setShowPalette(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleRenameSubmit();
        if (e.key === 'Escape') {
            setRenameValue(project.title);
            setIsRenaming(false);
        }
    };

    return (
        <div style={{ marginLeft: depth * 12 }}>
            <div
                role="button"
                onClick={() => onNavigate(project.id)}
                className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors group relative cursor-pointer select-none",
                    activeId === `/project/${project.id}`
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 font-medium"
                        : "text-text-secondary hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-text-primary"
                )}
            >
                <div
                    className={cn("p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700", hasChildren ? "opacity-100" : "opacity-0")}
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(!expanded);
                    }}
                >
                    {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </div>

                {/* Color Dot / Hash */}
                <div className="relative">
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowPalette(!showPalette);
                        }}
                        className="w-3 h-3 rounded-full flex-shrink-0 cursor-pointer shadow-sm hover:ring-2 ring-blue-200 transition-all hover:scale-110"
                        style={{ backgroundColor: project.color || '#a1a1aa' }}
                        title="Change Color"
                    />

                    {/* Mini Palette Popover */}
                    {showPalette && (
                        <div className="absolute top-5 left-0 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-1.5 rounded-lg shadow-xl grid grid-cols-5 gap-1 w-[120px]" onClick={e => e.stopPropagation()}>
                            {PASTEL_PALETTE.map(c => (
                                <div
                                    key={c}
                                    className="w-4 h-4 rounded-full cursor-pointer hover:scale-110 transition-transform ring-1 ring-black/5"
                                    style={{ backgroundColor: c }}
                                    onClick={() => handleColorChange(c)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {isRenaming ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleRenameSubmit}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-0 bg-white dark:bg-zinc-900 border border-blue-500 rounded px-1 py-0 text-sm focus:outline-none"
                    />
                ) : (
                    <span className="flex-1 text-left truncate">{project.title}</span>
                )}

                <div className="hidden group-hover:flex items-center gap-1 ml-auto">
                    <button
                        className="p-1 px-[0.38rem] hover:text-blue-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsRenaming(true);
                        }}
                        title="Rename"
                    >
                        <Edit2 size={10} />
                    </button>
                    <button
                        className="p-1 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                        onClick={(e) => onDelete(project.id, e)}
                        title="Delete Project"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {expanded && children.length > 0 && (
                <div className="border-l border-zinc-100 dark:border-zinc-800 ml-3">
                    {children.map(child => (
                        <ProjectTreeItem
                            key={child.id}
                            project={child}
                            allProjects={allProjects}
                            activeId={activeId}
                            onNavigate={onNavigate}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export function Sidebar({ isOpen }: { isOpen: boolean }) {
    const router = useRouter();
    const pathname = usePathname();
    const [projectsExpanded, setProjectsExpanded] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
    const [settingsTab, setSettingsTab] = useState<'sync' | 'calendar'>('sync');

    const { dashboardView, setDashboardView } = useStore();
    const { user, isGuest, signOut } = useAuth();
    console.log("Sidebar Render - User:", user);

    // Live Query for Projects
    const projects = useLiveQuery(() => db.projects.toArray()) || [];

    const handleCreateProject = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const id = `proj_${Date.now()}`;
            await db.projects.add({
                id,
                title: "New Project",
                created_at: Date.now(),
                updated_at: Date.now(),
                sync_status: 'dirty',
                color: getRandomPaletteColor(),
                is_archived: false
            });
            router.push(`/project/${id}`);
        } catch (err) {
            console.error("Failed to create project", err);
        }
    };

    const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setProjectToDelete(id);
    }

    return (
        <aside
            className={cn(
                "flex-shrink-0 bg-background dark:bg-surface-dark border-r border-border h-full flex flex-col transition-all duration-300",
                isOpen ? "w-[260px] opacity-100" : "w-0 opacity-0 overflow-hidden"
            )}
        >
            {/* User Header */}
            <div className="h-14 flex items-center px-4 mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs text-white font-medium">
                        {(user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-medium text-text-primary truncate">
                            {user?.name || user?.email || 'User'}
                        </span>
                        {isGuest && <span className="text-[10px] text-zinc-500">Offline Mode</span>}
                    </div>
                </div>
            </div>

            {/* TOP SECTION: Static Links */}
            <div className="px-2 space-y-0.5 mb-6">
                <SidebarItem
                    icon={Inbox}
                    label="Inbox"
                    active={(pathname === '/inbox' || pathname === '/') && dashboardView === 'inbox'}
                    onClick={() => {
                        setDashboardView('inbox');
                        router.push('/inbox');
                    }}
                />
                <SidebarItem
                    icon={Calendar}
                    label="Today"
                    active={pathname === '/today' && dashboardView === 'today'}
                    onClick={() => {
                        setDashboardView('today');
                        router.push('/today');
                    }}
                />
                <SidebarItem
                    icon={CalendarDays}
                    label="Upcoming"
                    active={pathname === '/upcoming' && dashboardView === 'upcoming'}
                    onClick={() => {
                        setDashboardView('upcoming');
                        router.push('/upcoming');
                    }}
                />
                <SidebarItem
                    icon={MessageSquare}
                    label="AI Chat"
                    active={pathname === '/ai-chat'}
                    onClick={() => {
                        setDashboardView('ai-chat');
                        router.push('/ai-chat');
                    }}
                />
                <div className="my-2 border-t border-zinc-100 dark:border-zinc-800" />
                <SidebarItem
                    icon={Zap}
                    label="Flashcards"
                    onClick={() => {
                        router.push('/flashcards');
                    }}
                    active={pathname === '/flashcards'}
                />
            </div>

            {/* BOTTOM SECTION: Projects */}
            <div className="flex-1 overflow-y-auto px-2">
                <div
                    className="flex items-center justify-between px-2 py-1 mb-1 group cursor-pointer"
                    onClick={() => setProjectsExpanded(!projectsExpanded)}
                >
                    <div className="flex items-center gap-1 text-xs font-semibold text-zinc-500 group-hover:text-zinc-800 dark:group-hover:text-zinc-300">
                        {projectsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span>Projects</span>
                    </div>
                    <button
                        onClick={handleCreateProject}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-opacity"
                    >
                        <Plus size={12} />
                    </button>
                </div>

                {projectsExpanded && (
                    <div className="space-y-0.5 pl-1">
                        {projects.length === 0 && (
                            <div className="px-3 py-2 text-[11px] text-zinc-400 italic">No projects yet.</div>
                        )}
                        {projects.filter(p => !p.parent_project_id).map((project: Project) => (
                            <ProjectTreeItem
                                key={project.id}
                                project={project}
                                allProjects={projects}
                                activeId={pathname}
                                onNavigate={(id) => router.push(`/project/${id}`)}
                                onDelete={handleDeleteProject}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-border mt-auto">
                <SidebarItem icon={Trash2} label="Trash" />
                <SidebarItem
                    icon={Settings}
                    label="Settings"
                    onClick={() => setShowSettings(true)}
                />
                <SidebarItem
                    icon={LogOut}
                    label="Log Out"
                    onClick={() => setShowLogoutConfirm(true)}
                />
            </div>

            {/* Logout Confirmation Modal */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)}>
                    <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-sm overflow-hidden relative p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-text-primary mb-2">Log Out</h3>
                        <p className="text-sm text-text-secondary mb-6">
                            Are you sure you want to log out? This will clear your local data and session.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    setShowLogoutConfirm(false);
                                    await signOut();
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors shadow-sm"
                            >
                                Log Out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
                    <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-lg overflow-hidden relative flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-border px-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                            <div className="flex">
                                <button
                                    onClick={() => setSettingsTab('sync')}
                                    className={cn(
                                        "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                                        settingsTab === 'sync'
                                            ? "border-primary text-primary"
                                            : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                    )}
                                >
                                    Sync & Storage
                                </button>
                                <button
                                    onClick={() => setSettingsTab('calendar')}
                                    className={cn(
                                        "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                                        settingsTab === 'calendar'
                                            ? "border-primary text-primary"
                                            : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                    )}
                                >
                                    Smart Import
                                </button>
                            </div>
                            <button
                                className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 p-1"
                                onClick={() => setShowSettings(false)}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            {settingsTab === 'sync' ? <SyncSettings /> : <CalendarSettings />}
                        </div>
                    </div>
                </div>
            )}

            {/* Project Delete Confirmation Modal */}
            {
                projectToDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setProjectToDelete(null)}>
                        <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-sm overflow-hidden relative p-6" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-semibold text-text-primary mb-2">Delete Project</h3>
                            <p className="text-sm text-text-secondary mb-6">
                                Are you sure you want to delete this project? This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setProjectToDelete(null)}
                                    className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        if (projectToDelete) {
                                            await db.projects.delete(projectToDelete);
                                            // TODO: Implement cascade delete for blocks if needed
                                            setProjectToDelete(null);
                                            router.push('/inbox');
                                        }
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors shadow-sm"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </aside >
    );
}
