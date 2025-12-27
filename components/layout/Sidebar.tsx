"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Project } from "@/lib/db";
import { useRouter, usePathname } from "next/navigation";
import { useProjectStore } from "@/lib/store";
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
    MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export function Sidebar({ isOpen }: { isOpen: boolean }) {
    const router = useRouter();
    const pathname = usePathname();
    const [projectsExpanded, setProjectsExpanded] = useState(true);

    const { dashboardView, setDashboardView } = useProjectStore();

    // Live Query for Projects
    const projects = useLiveQuery(() => db.projects.toArray()) || [];

    const handleCreateProject = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const id = `proj_${Date.now()}`;
            await db.projects.add({
                id,
                name: "New Project",
                created_at: Date.now(),
                updated_at: Date.now(),
                color: "bg-zinc-400"
            });
            router.push(`/project/${id}`);
        } catch (err) {
            console.error("Failed to create project", err);
        }
    };

    const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Delete this project?")) {
            await db.projects.delete(id);
            // also delete blocks
            // const blocks = await db.blocks.where('parent_id').equals(id).toArray(); 
            // TODO: Implement cascade delete
            router.push('/inbox');
        }
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
                        U
                    </div>
                    <span className="text-sm font-medium text-text-primary">My Workspace</span>
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
                        setDashboardView('ai-chat'); // Assuming 'ai-chat' is valid or ignored
                        router.push('/ai-chat');
                    }}
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
                        {projects.map((project: Project) => (
                            <SidebarItem
                                key={project.id}
                                icon={Hash}
                                label={project.name}
                                active={pathname === `/project/${project.id}`}
                                onClick={() => router.push(`/project/${project.id}`)}
                                rightElement={
                                    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            className="p-1.5 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                            onClick={(e) => handleDeleteProject(project.id, e)}
                                            title="Delete Project"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                }
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-border mt-auto">
                <SidebarItem icon={Trash2} label="Trash" />
                <SidebarItem icon={Settings} label="Settings" />
            </div>
        </aside>
    );
}
