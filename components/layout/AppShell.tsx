"use client";

import React, { useState } from "react";
import {
    Inbox,
    Calendar,
    CalendarDays,
    Trash2,
    Settings,
    Menu,
    ChevronRight,
    ChevronDown,
    MoreVertical,
    Edit2,
    Trash
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ContextPanel } from "./ContextPanel";
import { PDFContextPanel } from "@/components/pdf/PDFContextPanel";
import { useProjectStore } from "@/lib/store";
import { useEffect } from "react";

const PROJECT_COLORS = [
    { name: "Slate", value: "bg-zinc-400" },
    { name: "Blue", value: "bg-blue-500" },
    { name: "Red", value: "bg-red-500" },
    { name: "Green", value: "bg-emerald-500" },
    { name: "Yellow", value: "bg-amber-400" },
    { name: "Purple", value: "bg-violet-500" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const {
        contextPanelOpen,
        setContextPanelOpen,
        dashboardView,
        setDashboardView,
        projects,
        loadProjects,
        deleteProject,
        updateProject
    } = useProjectStore();
    const [projectsExpanded, setProjectsExpanded] = useState(true);
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editColor, setEditColor] = useState("");
    const [editDueDate, setEditDueDate] = useState<number | undefined>(undefined);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    const handleEditProject = (project: any) => {
        setEditingProjectId(project.id);
        setEditName(project.name);
        setEditColor(project.color || "bg-zinc-400");
        setEditDueDate(project.due_date);
    };

    const saveProjectEdit = async () => {
        if (editingProjectId && editName.trim()) {
            await updateProject(editingProjectId, {
                name: editName,
                color: editColor,
                due_date: editDueDate
            });
            setEditingProjectId(null);
        }
    };

    const handleDeleteProject = async (id: string) => {
        console.log("UI: Requesting delete for project", id);
        if (confirm("Are you sure you want to delete this project? Tasks will remain but project reference will be gone.")) {
            try {
                await deleteProject(id);
                console.log("UI: Project delete command sent");
            } catch (err) {
                console.error("UI: Delete failed", err);
            }
        }
    };

    // Todoist-like Sidebar Item
    const SidebarItem = ({ icon: Icon, label, count, active, onClick }: any) => (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors group",
                active
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 font-medium"
                    : "text-text-secondary hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-text-primary"
            )}
        >
            <Icon className="w-4 h-4" />
            <span className="flex-1 text-left">{label}</span>
            {count && <span className="text-xs opacity-60 group-hover:hidden">{count}</span>}
        </button>
    );

    return (
        <div className="flex h-screen w-screen bg-surface dark:bg-background overflow-hidden font-geist">

            {/* SIDEBAR (Left) */}
            <aside
                className={cn(
                    "flex-shrink-0 bg-background dark:bg-surface-dark border-r-0 transform transition-all duration-300 ease-in-out flex flex-col",
                    isSidebarOpen ? "w-[260px] opacity-100" : "w-0 opacity-0 overflow-hidden"
                )}
            >
                {/* User Header */}
                <div className="h-14 flex items-center px-4 mb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs text-white font-medium">
                            U
                        </div>
                        <span className="text-sm font-medium text-text-primary">User Name</span>
                    </div>
                </div>

                {/* Quick Links */}
                <div className="px-2 space-y-0.5">
                    <SidebarItem
                        icon={Inbox}
                        label="Inbox"
                        active={dashboardView === 'inbox'}
                        onClick={() => setDashboardView('inbox')}
                    />
                    <SidebarItem
                        icon={Calendar}
                        label="Today"
                        active={dashboardView === 'today'}
                        onClick={() => setDashboardView('today')}
                    />
                    <SidebarItem
                        icon={CalendarDays}
                        label="Upcoming"
                        active={dashboardView === 'upcoming'}
                        onClick={() => setDashboardView('upcoming')}
                    />
                </div>

                {/* Projects Tree */}
                <div className="mt-6 px-2">
                    <div
                        className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-text-primary"
                        onClick={() => setProjectsExpanded(!projectsExpanded)}
                    >
                        <span>Projects</span>
                        {projectsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </div>

                    {projectsExpanded && (
                        <div className="mt-1 space-y-0.5">
                            {projects.map((project) => (
                                <div key={project.id} className="group relative">
                                    {editingProjectId === project.id ? (
                                        <div className="mx-1 my-2 p-3 bg-white dark:bg-zinc-900 border border-primary/30 rounded-lg shadow-sm space-y-3 animate-in fade-in slide-in-from-top-1">
                                            <div>
                                                <label className="text-[10px] font-semibold text-zinc-400 uppercase">Project Name</label>
                                                <input
                                                    autoFocus
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="w-full bg-zinc-50 dark:bg-zinc-800 text-sm px-2 py-1.5 rounded border border-border outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-semibold text-zinc-400 uppercase">Color</label>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {PROJECT_COLORS.map(c => (
                                                        <button
                                                            key={c.value}
                                                            onClick={() => setEditColor(c.value)}
                                                            className={cn(
                                                                "w-5 h-5 rounded-full transition-transform",
                                                                c.value,
                                                                editColor === c.value ? "ring-2 ring-primary ring-offset-1 scale-110" : "hover:scale-110"
                                                            )}
                                                            title={c.name}
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-semibold text-zinc-400 uppercase">Due Date</label>
                                                <input
                                                    type="date"
                                                    value={editDueDate ? new Date(editDueDate).toISOString().split('T')[0] : ""}
                                                    onChange={(e) => setEditDueDate(e.target.valueAsDate?.getTime())}
                                                    className="w-full bg-zinc-50 dark:bg-zinc-800 text-sm px-2 py-1.5 rounded border border-border outline-none"
                                                />
                                            </div>

                                            <div className="flex justify-between items-center pt-2">
                                                <button
                                                    onClick={() => handleDeleteProject(project.id)}
                                                    className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1 font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                                                >
                                                    <Trash size={10} />
                                                    Delete Project
                                                </button>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setEditingProjectId(null)}
                                                        className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={saveProjectEdit}
                                                        className="px-3 py-1 text-xs bg-primary text-white rounded font-medium hover:bg-primary/90"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-text-secondary hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer">
                                            <span className={cn("w-2 h-2 rounded-full", project.color || "bg-zinc-400")} />
                                            <div className="flex-1 min-w-0">
                                                <p className="truncate">{project.name}</p>
                                                {project.due_date && (
                                                    <p className="text-[10px] opacity-50">Due {new Date(project.due_date).toLocaleDateString()}</p>
                                                )}
                                            </div>

                                            {/* Action Buttons (Visible on Hover) */}
                                            <div className="hidden group-hover:flex items-center gap-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditProject(project);
                                                    }}
                                                    className="p-1 hover:text-primary transition-colors"
                                                    title="Edit Settings"
                                                >
                                                    <Settings size={12} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteProject(project.id);
                                                    }}
                                                    className="p-1 hover:text-red-500 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {projects.length === 0 && (
                                <div className="px-4 py-2 text-[10px] text-zinc-500 italic">
                                    No projects created yet. Use "Project: Name" in Quick Add!
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-auto p-4 border-t border-border/50">
                    <SidebarItem icon={Trash2} label="Trash" />
                    <SidebarItem icon={Settings} label="Settings" />
                </div>
            </aside>

            {/* MAIN STAGE (Center) */}
            <main className="flex-1 flex flex-col h-full relative z-0 overflow-hidden bg-surface transition-all duration-300">

                {/* Toggle Sidebar Button (Mobile/Desktop) */}
                <div className="absolute top-4 left-4 z-40">
                    {!isSidebarOpen && (
                        <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-zinc-100 rounded-md">
                            <Menu className="w-5 h-5 text-text-secondary" />
                        </button>
                    )}
                    {isSidebarOpen && (
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="p-1 text-text-secondary hover:bg-zinc-100 rounded opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 right-2"
                            title="Close Sidebar"
                        >
                            <Menu className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Content Container */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto pt-16 px-6 pb-20 min-h-full">
                        {/* Header Removed - Children should provide their own header */}
                        {/* 
                        <header className="mb-8">
                            <h1 className="text-3xl font-bold text-text-primary tracking-tight">Today</h1>
                            <p className="text-text-secondary text-sm mt-1">
                                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
                            </p>
                        </header> 
                        */}

                        {children}
                    </div>
                </div>

            </main>

            {/* CONTEXT PANEL (Right) */}
            <ContextPanel isOpen={contextPanelOpen} onClose={() => setContextPanelOpen(false)}>
                <PDFContextPanel />
            </ContextPanel>

            {/* Toggle Context Panel (Debug/Dev for now) */}
            <div className="absolute top-4 right-4 z-40">
                <button
                    onClick={() => setContextPanelOpen(!contextPanelOpen)}
                    className="p-2 text-text-secondary hover:bg-zinc-100 rounded-md"
                >
                    <Menu className="w-5 h-5" />
                </button>
            </div>

        </div>
    );
}
