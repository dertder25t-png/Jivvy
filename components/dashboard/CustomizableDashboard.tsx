'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { db, type Block, type Project } from '@/lib/db';
import { useProjectStore } from '@/lib/store';
import { InsightCard, OneSentenceInsight } from './InsightCard';
import { QuickAdd } from '@/components/QuickAdd';
import {
    GripVertical,
    Settings,
    Plus,
    X,
    FileText,
    Brain,
    CheckSquare,
    Calendar,
    Lightbulb,
    AlertCircle,
    ChevronRight,
    Loader2,
    RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export type WidgetType = 'recent_docs' | 'superlearn' | 'upcoming_tasks' | 'quick_capture';

export interface WidgetConfig {
    id: string;
    type: WidgetType;
    title: string;
    order: number;
    visible: boolean;
    settings?: Record<string, unknown>;
}

export interface DashboardLayout {
    widgets: WidgetConfig[];
    lastModified: number;
}

interface WidgetProps {
    config: WidgetConfig;
    onError?: (error: Error) => void;
    onNavigate?: (path: string) => void;
}

interface WidgetWrapperProps {
    config: WidgetConfig;
    children: ReactNode;
    onRemove?: () => void;
    onDragStart?: () => void;
    isDragging?: boolean;
    error?: string | null;
    onRetry?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'jivvy-dashboard-layout';

const DEFAULT_WIDGETS: WidgetConfig[] = [
    { id: 'recent_docs', type: 'recent_docs', title: 'Recent Docs', order: 0, visible: true },
    { id: 'superlearn', type: 'superlearn', title: 'Super Learn', order: 1, visible: true },
    { id: 'upcoming_tasks', type: 'upcoming_tasks', title: 'Upcoming Tasks', order: 2, visible: true },
    { id: 'quick_capture', type: 'quick_capture', title: 'Quick Capture', order: 3, visible: true },
];

const WIDGET_ICONS: Record<WidgetType, typeof FileText> = {
    recent_docs: FileText,
    superlearn: Brain,
    upcoming_tasks: CheckSquare,
    quick_capture: Lightbulb,
};

// ============================================================================
// WIDGET WRAPPER (Error Boundary)
// ============================================================================

function WidgetWrapper({
    config,
    children,
    onRemove,
    onDragStart,
    isDragging,
    error,
    onRetry,
}: WidgetWrapperProps) {
    const Icon = WIDGET_ICONS[config.type] || FileText;

    return (
        <div
            className={cn(
                "bg-white dark:bg-zinc-900 rounded-2xl border border-border shadow-sm transition-all",
                isDragging && "ring-2 ring-primary/30 shadow-lg"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <button
                        onMouseDown={onDragStart}
                        className="p-1 -ml-1 cursor-grab active:cursor-grabbing text-text-secondary hover:text-text-primary"
                    >
                        <GripVertical className="w-4 h-4" />
                    </button>
                    <Icon className="w-4 h-4 text-text-secondary" />
                    <h3 className="font-medium text-sm text-text-primary">{config.title}</h3>
                </div>
                {onRemove && (
                    <button
                        onClick={onRemove}
                        className="p-1 text-text-secondary hover:text-red-500 transition-colors"
                        title="Remove widget"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                {error ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                        <p className="text-sm text-text-secondary mb-3">{error}</p>
                        {onRetry && (
                            <button
                                onClick={onRetry}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Retry
                            </button>
                        )}
                    </div>
                ) : (
                    children
                )}
            </div>
        </div>
    );
}

// ============================================================================
// RECENT DOCS WIDGET
// ============================================================================

function RecentDocsWidget({ config, onNavigate }: WidgetProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const all = await db.projects.orderBy('updated_at').reverse().limit(5).toArray();
            setProjects(all);
        } catch (e) {
            setError('Failed to load projects');
            console.error('[RecentDocsWidget]', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    if (loading) {
        return (
            <WidgetWrapper config={config}>
                <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
                </div>
            </WidgetWrapper>
        );
    }

    return (
        <WidgetWrapper config={config} error={error} onRetry={load}>
            {projects.length === 0 ? (
                <p className="text-sm text-text-secondary text-center py-4">
                    No recent documents
                </p>
            ) : (
                <div className="space-y-2">
                    {projects.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => onNavigate?.(`/project/${p.id}`)}
                            className="w-full flex items-center justify-between p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors group"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <div
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: p.color || '#6366f1' }}
                                />
                                <span className="text-sm text-text-primary truncate">
                                    {p.name}
                                </span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    ))}
                </div>
            )}
        </WidgetWrapper>
    );
}

// ============================================================================
// SUPER LEARN WIDGET
// ============================================================================

function SuperLearnWidget({ config, onNavigate }: WidgetProps) {
    const [projectId, setProjectId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get the most recent project with analytics
        async function findProject() {
            try {
                const concepts = await db.analytics_concepts.limit(1).toArray();
                if (concepts.length > 0) {
                    setProjectId(concepts[0].project_id);
                }
            } catch (e) {
                console.error('[SuperLearnWidget]', e);
            } finally {
                setLoading(false);
            }
        }
        findProject();
    }, []);

    if (loading) {
        return (
            <WidgetWrapper config={config}>
                <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
                </div>
            </WidgetWrapper>
        );
    }

    return (
        <WidgetWrapper config={config}>
            {projectId ? (
                <div className="space-y-3">
                    <InsightCard
                        projectId={projectId}
                        onNavigateToBlock={(blockId) => onNavigate?.(`/project/${projectId}?block=${blockId}`)}
                        className="border-0 shadow-none p-0"
                    />
                    <button
                        onClick={() => onNavigate?.(`/project/${projectId}`)}
                        className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Brain className="w-4 h-4" />
                        Start Learning Session
                    </button>
                </div>
            ) : (
                <div className="text-center py-4">
                    <Brain className="w-8 h-8 text-text-secondary/30 mx-auto mb-2" />
                    <p className="text-sm text-text-secondary">
                        Add lecture notes to unlock study insights
                    </p>
                </div>
            )}
        </WidgetWrapper>
    );
}

// ============================================================================
// UPCOMING TASKS WIDGET
// ============================================================================

function UpcomingTasksWidget({ config, onNavigate }: WidgetProps) {
    const [tasks, setTasks] = useState<Block[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const now = Date.now();
            const oneWeekLater = now + 7 * 24 * 60 * 60 * 1000;

            // Get tasks with due dates in the next week
            const all = await db.blocks
                .where('[type+properties.due_date]')
                .between(['task', now], ['task', oneWeekLater])
                .limit(5)
                .toArray();

            setTasks(all);
        } catch (e) {
            // Fallback if compound index fails
            try {
                const allTasks = await db.blocks.where('type').equals('task').toArray();
                const now = Date.now();
                const filtered = allTasks
                    .filter((t) => t.properties?.due_date && t.properties.due_date > now)
                    .sort((a, b) => (a.properties?.due_date || 0) - (b.properties?.due_date || 0))
                    .slice(0, 5);
                setTasks(filtered);
            } catch (e2) {
                setError('Failed to load tasks');
                console.error('[UpcomingTasksWidget]', e2);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    if (loading) {
        return (
            <WidgetWrapper config={config}>
                <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
                </div>
            </WidgetWrapper>
        );
    }

    return (
        <WidgetWrapper config={config} error={error} onRetry={load}>
            {tasks.length === 0 ? (
                <div className="text-center py-4">
                    <CheckSquare className="w-8 h-8 text-text-secondary/30 mx-auto mb-2" />
                    <p className="text-sm text-text-secondary">
                        No upcoming tasks
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {tasks.map((task) => (
                        <div
                            key={task.id}
                            className="flex items-start gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            <CheckSquare className="w-4 h-4 text-text-secondary mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-text-primary truncate">
                                    {task.content}
                                </p>
                                {task.properties?.due_date && (
                                    <span className="flex items-center gap-1 text-xs text-text-secondary mt-0.5">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(task.properties.due_date).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </WidgetWrapper>
    );
}

// ============================================================================
// QUICK CAPTURE WIDGET
// ============================================================================

function QuickCaptureWidget({ config }: WidgetProps) {
    const [refreshKey, setRefreshKey] = useState(0);

    return (
        <WidgetWrapper config={config}>
            <QuickAdd
                key={refreshKey}
                onTaskAdded={() => setRefreshKey((k) => k + 1)}
            />
        </WidgetWrapper>
    );
}

// ============================================================================
// WIDGET FACTORY
// ============================================================================

function WidgetFactory({ config, onNavigate }: { config: WidgetConfig; onNavigate?: (path: string) => void }) {
    switch (config.type) {
        case 'recent_docs':
            return <RecentDocsWidget config={config} onNavigate={onNavigate} />;
        case 'superlearn':
            return <SuperLearnWidget config={config} onNavigate={onNavigate} />;
        case 'upcoming_tasks':
            return <UpcomingTasksWidget config={config} onNavigate={onNavigate} />;
        case 'quick_capture':
            return <QuickCaptureWidget config={config} />;
        default:
            return null;
    }
}

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export interface CustomizableDashboardProps {
    onNavigate?: (path: string) => void;
    className?: string;
}

export function CustomizableDashboard({ onNavigate, className }: CustomizableDashboardProps) {
    const [layout, setLayout] = useState<DashboardLayout>(() => {
        // Load from localStorage
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.widgets && Array.isArray(parsed.widgets)) {
                        return parsed;
                    }
                }
            } catch (e) {
                console.warn('[Dashboard] Failed to load layout:', e);
            }
        }
        return { widgets: DEFAULT_WIDGETS, lastModified: Date.now() };
    });

    const [showSettings, setShowSettings] = useState(false);

    // Save layout to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
        } catch (e) {
            console.warn('[Dashboard] Failed to save layout:', e);
        }
    }, [layout]);

    // Get visible widgets sorted by order
    const visibleWidgets = useMemo(() => {
        return layout.widgets
            .filter((w) => w.visible)
            .sort((a, b) => a.order - b.order);
    }, [layout.widgets]);

    // Toggle widget visibility
    const toggleWidget = useCallback((id: string) => {
        setLayout((prev) => ({
            ...prev,
            lastModified: Date.now(),
            widgets: prev.widgets.map((w) =>
                w.id === id ? { ...w, visible: !w.visible } : w
            ),
        }));
    }, []);

    // Reset to defaults
    const resetLayout = useCallback(() => {
        setLayout({ widgets: DEFAULT_WIDGETS, lastModified: Date.now() });
    }, []);

    return (
        <div className={cn("space-y-6", className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
                    <OneSentenceInsight className="mt-1" />
                </div>
                <button
                    onClick={() => setShowSettings((s) => !s)}
                    className={cn(
                        "p-2 rounded-lg transition-colors",
                        showSettings
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-secondary"
                    )}
                >
                    <Settings className="w-5 h-5" />
                </button>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-border space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium text-text-primary">Customize Dashboard</h3>
                        <button
                            onClick={resetLayout}
                            className="text-xs text-primary hover:underline"
                        >
                            Reset to defaults
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {layout.widgets.map((widget) => {
                            const Icon = WIDGET_ICONS[widget.type];
                            return (
                                <button
                                    key={widget.id}
                                    onClick={() => toggleWidget(widget.id)}
                                    className={cn(
                                        "flex items-center gap-2 p-3 rounded-xl border transition-colors",
                                        widget.visible
                                            ? "border-primary bg-primary/5 text-primary"
                                            : "border-border bg-white dark:bg-zinc-900 text-text-secondary"
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="text-sm font-medium">{widget.title}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Widget Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibleWidgets.map((widget) => (
                    <WidgetFactory key={widget.id} config={widget} onNavigate={onNavigate} />
                ))}
            </div>

            {/* Empty state */}
            {visibleWidgets.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Plus className="w-10 h-10 text-text-secondary/30 mb-3" />
                    <p className="text-sm text-text-secondary">
                        No widgets visible. Click the settings icon to add some.
                    </p>
                </div>
            )}
        </div>
    );
}

export default CustomizableDashboard;
