'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db, Project } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';

interface ProjectHeaderProps {
    projectId: string;
}

export function ProjectHeader({ projectId }: ProjectHeaderProps) {
    const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);

    // Breadcrumb logic
    const breadcrumbs = useLiveQuery(async () => {
        if (!project) return [];
        const crumbs: Project[] = [];
        let current = project;
        while (current.parent_project_id) {
            const parent = await db.projects.get(current.parent_project_id);
            if (!parent) break;
            crumbs.unshift(parent);
            current = parent;
        }
        return crumbs;
    }, [project]);

    // Renaming logic
    const [isRenaming, setIsRenaming] = useState(false);
    const [title, setTitle] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (project) setTitle(project.title);
    }, [project]);

    useEffect(() => {
        if (isRenaming && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isRenaming]);

    const handleRename = async () => {
        if (!project) return;
        if (title.trim() && title !== project.title) {
            await db.projects.update(projectId, {
                title,
                updated_at: Date.now(),
                sync_status: 'dirty'
            });
        }
        setIsRenaming(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleRename();
        if (e.key === 'Escape') {
            setTitle(project?.title || '');
            setIsRenaming(false);
        }
    };

    if (!project) return <div className="h-16" />;

    return (
        <div className="flex flex-col gap-2 px-12 pt-8 pb-4 max-w-4xl mx-auto w-full">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1 text-sm text-zinc-500">
                <Link href="/projects" className="hover:text-zinc-800 dark:hover:text-zinc-300 flex items-center gap-1">
                    <Home size={14} />
                </Link>
                {breadcrumbs?.map(p => (
                    <React.Fragment key={p.id}>
                        <ChevronRight size={14} className="text-zinc-300" />
                        <Link href={`/project/${p.id}`} className="hover:text-zinc-800 dark:hover:text-zinc-300">
                            {p.title}
                        </Link>
                    </React.Fragment>
                ))}
            </div>

            {/* Title */}
            <div className="group relative flex items-center">
                {isRenaming ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={handleRename}
                        onKeyDown={handleKeyDown}
                        className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 bg-transparent outline-none w-full placeholder:text-zinc-300"
                        placeholder="Project Title"
                    />
                ) : (
                    <h1
                        onClick={() => setIsRenaming(true)}
                        className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 cursor-text hover:bg-zinc-50 dark:hover:bg-zinc-900/50 -ml-2 px-2 rounded -my-1 py-1 w-full"
                    >
                        {project.title}
                    </h1>
                )}
            </div>
        </div>
    );
}
