"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Block } from "@/lib/db";
import { BlockList } from "@/components/editor/BlockList";
import { DocView } from "@/components/views/DocView";
import { InfiniteCanvas } from "@/components/workspace/InfiniteCanvas";
import { useProjectStore } from "@/lib/store";
import { v4 as uuidv4 } from "uuid";
import { ArrowLeft, Clock, MoreHorizontal, Star, Share2 } from "lucide-react";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { getSuperLearnInsight, runSuperLearnAnalysis, type SuperLearnInsight, type SuperLearnStatus } from "@/utils/analytics/super-learn-client";

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
    const searchParams = useSearchParams();
    const projectId = params.id as string;

    const view = (searchParams.get('view') || 'blocks') as 'blocks' | 'doc' | 'canvas';

    const { setActiveProjectId, loadBlocks, setCenterMode } = useProjectStore();

    const MAX_CANVAS_SNAPSHOTS = 10;

    const [linearizeSummary, setLinearizeSummary] = useState<null | {
        total: number;
        moved: number;
        positioned: number;
        changedOrderValues: number;
    }>(null);
    const linearizeClearTimerRef = useRef<number | null>(null);

    const [snapshotBanner, setSnapshotBanner] = useState<null | { variant: 'success' | 'error'; message: string }>(null);
    const snapshotBannerTimerRef = useRef<number | null>(null);

    useEffect(() => {
        setActiveProjectId(projectId);
        if (view === 'canvas') {
            setCenterMode('canvas');
            loadBlocks(projectId);
        } else if (view === 'doc') {
            setCenterMode('paper');
        } else {
            setCenterMode('notes');
        }
    }, [loadBlocks, projectId, setActiveProjectId, setCenterMode, view]);

    const linearizeCanvasToDoc = useCallback(async () => {
        const topLevel = await db.blocks.where('parent_id').equals(projectId).toArray();
        const positioned = topLevel.filter(b => (b.metadata as any)?.position?.x !== undefined && (b.metadata as any)?.position?.y !== undefined);
        if (positioned.length === 0) return;

        const wantsSnapshot = window.confirm(
            "Warning: Canvas layout is freeform. Switching to Doc Mode will linearize your notes based on their Top-Left position.\n\nCreate a snapshot first?"
        );

        if (wantsSnapshot) {
            const snapshot = {
                id: uuidv4(),
                created_at: Date.now(),
                positions: topLevel.map(b => ({
                    id: b.id,
                    position: (b.metadata as any)?.position || null,
                    order: b.order,
                    parent_id: b.parent_id,
                }))
            };

            const project = await db.projects.get(projectId);
            const existing = (((project?.metadata as any)?.canvasSnapshots as any[]) || []) as any[];
            const nextSnapshots = [...existing, snapshot].slice(-MAX_CANVAS_SNAPSHOTS);
            await db.projects.update(projectId, {
                metadata: {
                    ...(project?.metadata || {}),
                    canvasSnapshots: [
                        ...nextSnapshots,
                    ],
                },
                updated_at: Date.now(),
            });
        }

        const before = [...topLevel]
            .sort((a, b) => {
                const ao = typeof a.order === 'number' ? a.order : 0;
                const bo = typeof b.order === 'number' ? b.order : 0;
                if (ao !== bo) return ao - bo;
                return String(a.id).localeCompare(String(b.id));
            })
            .map(b => b.id);
        const beforeIndex = new Map<string, number>();
        for (let i = 0; i < before.length; i++) beforeIndex.set(before[i], i);

        const sorted = [...topLevel].sort((a, b) => {
            const ap = (a.metadata as any)?.position;
            const bp = (b.metadata as any)?.position;
            const ay = ap?.y ?? 0;
            const by = bp?.y ?? 0;
            if (ay !== by) return ay - by;
            const ax = ap?.x ?? 0;
            const bx = bp?.x ?? 0;
            return ax - bx;
        });

        const after = sorted.map(b => b.id);
        let moved = 0;
        for (let i = 0; i < after.length; i++) {
            const prevIdx = beforeIndex.get(after[i]);
            if (prevIdx !== undefined && prevIdx !== i) moved += 1;
        }
        let changedOrderValues = 0;
        for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].order !== i) changedOrderValues += 1;
        }

        await db.transaction('rw', db.blocks, async () => {
            for (let i = 0; i < sorted.length; i++) {
                await db.blocks.update(sorted[i].id, { order: i });
            }
        });
        await db.projects.update(projectId, { updated_at: Date.now() });

        setLinearizeSummary({
            total: sorted.length,
            moved,
            positioned: positioned.length,
            changedOrderValues,
        });
        if (linearizeClearTimerRef.current) window.clearTimeout(linearizeClearTimerRef.current);
        linearizeClearTimerRef.current = window.setTimeout(() => setLinearizeSummary(null), 4500);
    }, [projectId]);

    const showSnapshotBanner = useCallback((variant: 'success' | 'error', message: string) => {
        setSnapshotBanner({ variant, message });
        if (snapshotBannerTimerRef.current) window.clearTimeout(snapshotBannerTimerRef.current);
        snapshotBannerTimerRef.current = window.setTimeout(() => setSnapshotBanner(null), 4500);
    }, []);

    const handleRestoreSnapshot = useCallback(async () => {
        try {
            const project = await db.projects.get(projectId);
            const snapshots = ((((project?.metadata as any)?.canvasSnapshots as any[]) || []) as any[])
                .filter(s => s && typeof s === 'object' && typeof s.created_at === 'number')
                .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));

            if (snapshots.length === 0) {
                showSnapshotBanner('error', 'No snapshots available yet');
                return;
            }

            const list = snapshots
                .map((s, idx) => {
                    const when = new Date(s.created_at).toLocaleString();
                    const count = Array.isArray(s.positions) ? s.positions.length : 0;
                    return `${idx + 1}) ${when} (${count} blocks)`;
                })
                .join('\n');

            const raw = window.prompt(`Restore which snapshot?\n\n${list}\n\nEnter a number (1-${snapshots.length})`);
            if (!raw) return;
            const n = Number(raw);
            if (!Number.isFinite(n) || n < 1 || n > snapshots.length) {
                showSnapshotBanner('error', 'Invalid snapshot selection');
                return;
            }

            const snapshot = snapshots[n - 1];
            const ok = window.confirm('Restoring a snapshot will overwrite current canvas positions and block order. Continue?');
            if (!ok) return;

            const positions = Array.isArray(snapshot.positions) ? snapshot.positions : [];
            const ids = positions.map((p: any) => String(p.id)).filter(Boolean);
            const existingBlocks = await db.blocks.bulkGet(ids);
            const existingIds = new Set(existingBlocks.filter(Boolean).map(b => (b as any).id));

            let updated = 0;
            await db.transaction('rw', db.blocks, async () => {
                for (const p of positions) {
                    const id = String(p?.id ?? '');
                    if (!id || !existingIds.has(id)) continue;

                    const nextMeta = (prev: any) => {
                        const base = (prev && typeof prev === 'object') ? { ...prev } : {};
                        base.position = p.position ?? null;
                        return base;
                    };

                    const current = await db.blocks.get(id);
                    const mergedMeta = nextMeta((current as any)?.metadata);
                    await db.blocks.update(id, {
                        order: typeof p.order === 'number' ? p.order : (current as any)?.order,
                        parent_id: typeof p.parent_id === 'string' ? p.parent_id : (current as any)?.parent_id,
                        metadata: mergedMeta,
                    } as any);
                    updated += 1;
                }
            });
            await db.projects.update(projectId, { updated_at: Date.now() });

            showSnapshotBanner('success', `Snapshot restored (${updated} blocks updated)`);
        } catch (e) {
            console.error('Snapshot restore failed', e);
            showSnapshotBanner('error', 'Snapshot restore failed');
        }
    }, [projectId, showSnapshotBanner]);

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

    // Phase 4: Super Learn (concept analytics)
    const [superLearnStatus, setSuperLearnStatus] = useState<SuperLearnStatus>('idle');
    const [superLearnInsight, setSuperLearnInsight] = useState<SuperLearnInsight | null>(null);
    const [superLearnError, setSuperLearnError] = useState<any>(null);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            setSuperLearnError(null);
            setSuperLearnStatus('analyzing');

            // Always refresh current insight (even if analysis no-ops).
            try {
                const current = await getSuperLearnInsight(projectId);
                if (!cancelled) setSuperLearnInsight(current);
            } catch (e) {
                if (!cancelled) setSuperLearnInsight(null);
            }

            const res = await runSuperLearnAnalysis(projectId, projectBlocks);
            if (cancelled) return;

            if (!res.ok) {
                setSuperLearnStatus('error');
                setSuperLearnError(res.error);
                return;
            }

            try {
                const next = await getSuperLearnInsight(projectId);
                if (!cancelled) setSuperLearnInsight(next);
            } catch {
                if (!cancelled) setSuperLearnInsight(null);
            }

            setSuperLearnStatus('ready');
        };

        // Debounce slightly to avoid running on every keystroke render.
        const handle = window.setTimeout(run, 800);
        return () => {
            cancelled = true;
            window.clearTimeout(handle);
        };
    }, [projectBlocks, projectId]);

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
                        {/* View toggle */}
                        <div className="hidden sm:flex items-center rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden mr-2">
                            <button
                                type="button"
                                onClick={() => router.replace(`/project/${projectId}?view=canvas`)}
                                className={`px-3 h-8 text-sm ${view === 'canvas'
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                                    : 'bg-transparent text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                                    }`}
                            >
                                Canvas
                            </button>
                            <button
                                type="button"
                                onClick={() => router.replace(`/project/${projectId}?view=blocks`)}
                                className={`px-3 h-8 text-sm ${view === 'blocks'
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                                    : 'bg-transparent text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                                    }`}
                            >
                                Blocks
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (view === 'canvas') {
                                        await linearizeCanvasToDoc();
                                    }
                                    router.replace(`/project/${projectId}?view=doc`);
                                }}
                                className={`px-3 h-8 text-sm ${view === 'doc'
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                                    : 'bg-transparent text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                                    }`}
                            >
                                Doc
                            </button>
                        </div>

                        <button
                            onClick={handleRestoreSnapshot}
                            className="hidden sm:inline-flex h-8 items-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            aria-label="Restore snapshot"
                        >
                            Snapshots
                        </button>

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

            {snapshotBanner && (
                <div className="max-w-4xl mx-auto px-6 mt-2">
                    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/30 px-3 py-2 flex items-center justify-between gap-3">
                        <div className={`text-xs ${snapshotBanner.variant === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {snapshotBanner.message}
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                if (snapshotBannerTimerRef.current) window.clearTimeout(snapshotBannerTimerRef.current);
                                snapshotBannerTimerRef.current = null;
                                setSnapshotBanner(null);
                            }}
                            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {linearizeSummary && (
                <div className="max-w-4xl mx-auto px-6 mt-2">
                    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/30 px-3 py-2 flex items-center justify-between gap-3">
                        <div className="text-xs text-zinc-600 dark:text-zinc-300">
                            Linearized {linearizeSummary.total} blocks • {linearizeSummary.moved} reordered
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                if (linearizeClearTimerRef.current) window.clearTimeout(linearizeClearTimerRef.current);
                                linearizeClearTimerRef.current = null;
                                setLinearizeSummary(null);
                            }}
                            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className={view === 'doc' || view === 'canvas' ? 'mx-auto' : 'max-w-4xl mx-auto py-12 px-8'}>
                {/* Notion-Style Header */}
                {view !== 'doc' ? (
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

                    {/* Super Learn (One-sentence analytics) */}
                    <div className="mt-5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/30 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Super Learn</div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {superLearnStatus === 'analyzing'
                                        ? 'Analyzing lecture concepts…'
                                        : superLearnStatus === 'error'
                                            ? 'Analysis failed'
                                            : superLearnInsight?.sentence || 'No concepts yet. Add lecture notes to start.'}
                                </div>
                            </div>

                            {superLearnInsight?.targetBlockId && superLearnStatus !== 'analyzing' && (
                                <button
                                    type="button"
                                    onClick={() => router.replace(`/project/${projectId}?view=blocks&focus=${encodeURIComponent(superLearnInsight.targetBlockId!)}`)}
                                    className="shrink-0 h-8 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/30 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-900"
                                >
                                    Start Review
                                </button>
                            )}
                        </div>

                        {superLearnError && (
                            <div className="mt-2">
                                <ErrorNotice error={superLearnError} />
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800 mt-6" />
                </div>
                ) : null}

                {/* Blocks Area */}
                {view === 'doc' ? (
                    <DocView projectId={projectId} />
                ) : view === 'canvas' ? (
                    <div className="h-[calc(100vh-3rem)]">
                        <InfiniteCanvas />
                    </div>
                ) : (
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
                )}
            </main>
        </div>
    );
}
