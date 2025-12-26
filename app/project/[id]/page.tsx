"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Block, Project } from "@/lib/db";
import { BlockList } from "@/components/editor/BlockList";
import { v4 as uuidv4 } from "uuid";
import { ArrowLeft, Clock, MoreHorizontal, Star, Share2 } from "lucide-react";

// Format relative time (e.g., "2 hours ago", "Yesterday")
function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: new Date(timestamp).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
    } else if (days > 1) {
        return `${days} days ago`;
    } else if (days === 1) {
        return 'Yesterday';
    } else if (hours > 1) {
        return `${hours} hours ago`;
    } else if (hours === 1) {
        return '1 hour ago';
    } else if (minutes > 1) {
        return `${minutes} minutes ago`;
    } else if (minutes === 1) {
        return '1 minute ago';
    } else {
        return 'Just now';
    }
}

export default function ProjectPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    // Local state for title editing
    const [localTitle, setLocalTitle] = useState<string>('');
    const [isTitleFocused, setIsTitleFocused] = useState(false);

    // Fetch Project with live updates
    const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);

    // Fetch Blocks for this project
    const allBlocks = useLiveQuery(() => db.blocks.toArray());

    // Sync local title with project name
    useEffect(() => {
        if (project && !isTitleFocused) {
            setLocalTitle(project.name);
        }
    }, [project, isTitleFocused]);

    // Filter for this project's blocks using BFS
    const projectBlocks = React.useMemo(() => {
        if (!allBlocks) return [];

        const relevantBlocks: Block[] = [];
        const childrenMap = new Map<string, Block[]>();

        allBlocks.forEach(b => {
            const pid = b.parent_id || 'root';
            if (!childrenMap.has(pid)) childrenMap.set(pid, []);
            childrenMap.get(pid)?.push(b);
        });

        const collect = (pid: string) => {
            const kids = childrenMap.get(pid);
            if (kids) {
                kids.forEach(k => {
                    relevantBlocks.push(k);
                    collect(k.id);
                });
            }
        };

        collect(projectId);
        return relevantBlocks;
    }, [allBlocks, projectId]);

    // Handle title change (local state for immediate feedback)
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalTitle(e.target.value);
    };

    // Save title on blur
    const handleTitleBlur = useCallback(async () => {
        setIsTitleFocused(false);
        if (project && localTitle !== project.name) {
            await db.projects.update(projectId, {
                name: localTitle || 'Untitled',
                updated_at: Date.now()
            });
        }
    }, [project, projectId, localTitle]);

    // Handle Enter key to blur title input
    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
        }
    };

    // Create first block when clicking empty area
    const handleEmptyClick = async () => {
        await db.blocks.add({
            id: uuidv4(),
            parent_id: projectId,
            content: '',
            type: 'text',
            order: 0
        });
        // Update project's updated_at
        await db.projects.update(projectId, { updated_at: Date.now() });
    };

    // Loading state
    if (!project) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-zinc-400 text-sm">Loading project...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-zinc-100 dark:border-zinc-800">
                <div className="max-w-4xl mx-auto px-6 h-12 flex items-center justify-between">
                    {/* Left: Back Button + Breadcrumb */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                            aria-label="Go back"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="flex items-center text-sm text-zinc-400">
                            <span className="hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer transition-colors" onClick={() => router.push('/')}>
                                Home
                            </span>
                            <span className="mx-2">/</span>
                            <span className="text-zinc-600 dark:text-zinc-300 font-medium truncate max-w-[200px]">
                                {project.name || 'Untitled'}
                            </span>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1">
                        <button
                            className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                            aria-label="Share"
                        >
                            <Share2 size={16} />
                        </button>
                        <button
                            className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                            aria-label="Favorite"
                        >
                            <Star size={16} />
                        </button>
                        <button
                            className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                            aria-label="More options"
                        >
                            <MoreHorizontal size={16} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto py-12 px-8">
                {/* Notion-Style Header */}
                <div className="mb-8">
                    {/* Project Color Accent (optional) */}
                    {project.color && (
                        <div
                            className="w-full h-1 rounded-full mb-6 opacity-60"
                            style={{ backgroundColor: project.color }}
                        />
                    )}

                    {/* Title Input */}
                    <input
                        className="text-4xl font-bold bg-transparent border-none outline-none w-full text-text-primary placeholder:text-zinc-300 focus:placeholder:text-zinc-400 transition-colors"
                        value={localTitle}
                        onChange={handleTitleChange}
                        onFocus={() => setIsTitleFocused(true)}
                        onBlur={handleTitleBlur}
                        onKeyDown={handleTitleKeyDown}
                        placeholder="Untitled"
                        spellCheck={false}
                    />

                    {/* Metadata Row */}
                    <div className="flex items-center gap-4 mt-4 text-sm text-zinc-400">
                        <div className="flex items-center gap-1.5">
                            <Clock size={14} />
                            <span>Edited {formatRelativeTime(project.updated_at || project.created_at)}</span>
                        </div>
                        {project.due_date && (
                            <div className="flex items-center gap-1.5 text-amber-600">
                                <span>Due {new Date(project.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                        )}
                        {project.priority && (
                            <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${project.priority === 'high'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    : project.priority === 'medium'
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                }`}>
                                {project.priority.charAt(0).toUpperCase() + project.priority.slice(1)} priority
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800 mt-6" />
                </div>

                {/* Blocks Area */}
                <div
                    className="flex-1 min-h-[500px] cursor-text"
                    onClick={projectBlocks.length === 0 ? handleEmptyClick : undefined}
                >
                    {projectBlocks && projectBlocks.length > 0 ? (
                        <BlockList projectId={projectId} initialBlocks={projectBlocks} />
                    ) : (
                        <div className="text-zinc-400 text-lg italic hover:text-zinc-500 transition-colors py-4">
                            Click anywhere or type <kbd className="px-1.5 py-0.5 mx-1 text-sm font-mono bg-zinc-100 dark:bg-zinc-800 rounded">/</kbd> to begin...
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
