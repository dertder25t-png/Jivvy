'use client';

import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db, type Block } from '@/lib/db';
import { parseICS, fetchAndParseICS, eventsToTasks, type TaskFromEvent } from '@/utils/ics-parser';
import {
    Calendar,
    Upload,
    Link as LinkIcon,
    CheckCircle2,
    Circle,
    AlertCircle,
    Loader2,
    X,
    Tag,
    Clock,
    FileText,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

type ImportStep = 'input' | 'preview' | 'importing' | 'complete';

interface SyllabusImportProps {
    projectId?: string;
    onComplete?: (createdCount: number) => void;
    onClose?: () => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SyllabusImport({ projectId, onComplete, onClose }: SyllabusImportProps) {
    const [step, setStep] = useState<ImportStep>('input');
    const [inputMode, setInputMode] = useState<'url' | 'file'>('url');
    const [urlInput, setUrlInput] = useState('');
    const [tasks, setTasks] = useState<TaskFromEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [createdCount, setCreatedCount] = useState(0);
    const [expandedTask, setExpandedTask] = useState<string | null>(null);

    // Handle URL input
    const handleFetchUrl = useCallback(async () => {
        if (!urlInput.trim()) {
            setError('Please enter a URL');
            return;
        }

        setLoading(true);
        setError(null);

        const result = await fetchAndParseICS(urlInput.trim());

        setLoading(false);

        if (!result.ok) {
            setError(result.error.message);
            return;
        }

        const taskList = eventsToTasks(result.events);
        if (taskList.length === 0) {
            setError('No future events found in this calendar');
            return;
        }

        setTasks(taskList);
        setStep('preview');
    }, [urlInput]);

    // Handle file upload
    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);

        try {
            const content = await file.text();
            const result = parseICS(content);

            if (!result.ok) {
                setError(result.error.message);
                setLoading(false);
                return;
            }

            const taskList = eventsToTasks(result.events);
            if (taskList.length === 0) {
                setError('No future events found in this calendar');
                setLoading(false);
                return;
            }

            setTasks(taskList);
            setStep('preview');
        } catch (err) {
            setError('Failed to read file');
        } finally {
            setLoading(false);
        }
    }, []);

    // Toggle task selection
    const toggleTask = useCallback((id: string) => {
        setTasks(prev => prev.map(t =>
            t.id === id ? { ...t, selected: !t.selected } : t
        ));
    }, []);

    // Select all / none
    const selectAll = useCallback((selected: boolean) => {
        setTasks(prev => prev.map(t => ({ ...t, selected })));
    }, []);

    // Import selected tasks
    const handleImport = useCallback(async () => {
        const selectedTasks = tasks.filter(t => t.selected);
        if (selectedTasks.length === 0) {
            setError('No tasks selected');
            return;
        }

        setStep('importing');
        setProgress(0);
        let created = 0;

        for (let i = 0; i < selectedTasks.length; i++) {
            const task = selectedTasks[i];
            setProgress(Math.round(((i + 1) / selectedTasks.length) * 100));

            try {
                const block: Block = {
                    id: uuidv4(),
                    parent_id: projectId || null,
                    content: task.content,
                    type: 'task',
                    order: Date.now() + i,
                    properties: {
                        due_date: task.dueDate,
                        tags: task.tags,
                    },
                    metadata: {
                        status: 'todo',
                        imported_from: 'ics',
                        import_source_uid: task.sourceEvent.uid,
                        description: task.description,
                    },
                };

                await db.blocks.add(block);
                created++;
            } catch (err) {
                console.error('[SyllabusImport] Failed to create task:', err);
            }
        }

        setCreatedCount(created);
        setStep('complete');
    }, [tasks, projectId]);

    // Render input step
    const renderInput = () => (
        <div className="space-y-6">
            {/* Mode toggle */}
            <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                <button
                    onClick={() => setInputMode('url')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors",
                        inputMode === 'url'
                            ? "bg-white dark:bg-zinc-700 text-text-primary shadow-sm"
                            : "text-text-secondary hover:text-text-primary"
                    )}
                >
                    <LinkIcon className="w-4 h-4" />
                    URL
                </button>
                <button
                    onClick={() => setInputMode('file')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors",
                        inputMode === 'file'
                            ? "bg-white dark:bg-zinc-700 text-text-primary shadow-sm"
                            : "text-text-secondary hover:text-text-primary"
                    )}
                >
                    <Upload className="w-4 h-4" />
                    File
                </button>
            </div>

            {/* URL input */}
            {inputMode === 'url' && (
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-text-primary">
                        Calendar URL
                    </label>
                    <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://calendar.google.com/calendar/ical/..."
                        className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-border rounded-xl text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <p className="text-xs text-text-secondary">
                        Paste your calendar's ICS feed URL. You can find this in your calendar app's sharing settings.
                    </p>
                    <button
                        onClick={handleFetchUrl}
                        disabled={loading || !urlInput.trim()}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Fetching...
                            </>
                        ) : (
                            <>
                                <Calendar className="w-4 h-4" />
                                Fetch Calendar
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* File input */}
            {inputMode === 'file' && (
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-text-primary">
                        Upload .ics File
                    </label>
                    <label className="block">
                        <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-border rounded-xl hover:border-primary/50 cursor-pointer transition-colors">
                            <Upload className="w-8 h-8 text-text-secondary mb-2" />
                            <span className="text-sm text-text-secondary">
                                Click to upload or drag and drop
                            </span>
                            <span className="text-xs text-text-secondary mt-1">
                                .ics files only
                            </span>
                        </div>
                        <input
                            type="file"
                            accept=".ics,text/calendar"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </label>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-red-700 dark:text-red-400 font-medium">Error</p>
                        <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">{error}</p>
                    </div>
                </div>
            )}
        </div>
    );

    // Render preview step
    const renderPreview = () => {
        const selectedCount = tasks.filter(t => t.selected).length;

        return (
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium text-text-primary">
                            {tasks.length} events found
                        </h3>
                        <p className="text-xs text-text-secondary">
                            {selectedCount} selected for import
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => selectAll(true)}
                            className="text-xs text-primary hover:underline"
                        >
                            Select all
                        </button>
                        <span className="text-text-secondary">|</span>
                        <button
                            onClick={() => selectAll(false)}
                            className="text-xs text-primary hover:underline"
                        >
                            Select none
                        </button>
                    </div>
                </div>

                {/* Task list */}
                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
                    {tasks.map(task => (
                        <div
                            key={task.id}
                            className={cn(
                                "border rounded-xl transition-colors",
                                task.selected
                                    ? "border-primary/30 bg-primary/5"
                                    : "border-border bg-white dark:bg-zinc-900"
                            )}
                        >
                            <div className="flex items-start gap-3 p-3">
                                <button
                                    onClick={() => toggleTask(task.id)}
                                    className="mt-0.5"
                                >
                                    {task.selected ? (
                                        <CheckCircle2 className="w-5 h-5 text-primary" />
                                    ) : (
                                        <Circle className="w-5 h-5 text-zinc-300" />
                                    )}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className={cn(
                                        "text-sm font-medium",
                                        task.selected ? "text-text-primary" : "text-text-secondary"
                                    )}>
                                        {task.content}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                        <span className="flex items-center gap-1 text-xs text-text-secondary">
                                            <Clock className="w-3 h-3" />
                                            {new Date(task.dueDate).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </span>
                                        {task.tags.map(tag => (
                                            <span
                                                key={tag}
                                                className={cn(
                                                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                                    tag === '#Urgent'
                                                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                                )}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                    {task.description && (
                                        <button
                                            onClick={() => setExpandedTask(
                                                expandedTask === task.id ? null : task.id
                                            )}
                                            className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                                        >
                                            {expandedTask === task.id ? (
                                                <>
                                                    <ChevronUp className="w-3 h-3" />
                                                    Hide details
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="w-3 h-3" />
                                                    Show details
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                            {expandedTask === task.id && task.description && (
                                <div className="px-11 pb-3">
                                    <p className="text-xs text-text-secondary whitespace-pre-wrap">
                                        {task.description}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={() => {
                            setStep('input');
                            setTasks([]);
                            setError(null);
                        }}
                        className="flex-1 py-3 border border-border rounded-xl text-sm font-medium text-text-secondary hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                        Back
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={selectedCount === 0}
                        className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Import {selectedCount} Task{selectedCount !== 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        );
    };

    // Render importing step
    const renderImporting = () => (
        <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-sm font-medium text-text-primary">
                Importing tasks...
            </p>
            <p className="text-xs text-text-secondary mt-1">
                {progress}% complete
            </p>
            <div className="w-full max-w-xs h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full mt-4 overflow-hidden">
                <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );

    // Render complete step
    const renderComplete = () => (
        <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary">
                Import Complete!
            </h3>
            <p className="text-sm text-text-secondary mt-1">
                Created {createdCount} task{createdCount !== 1 ? 's' : ''} from your calendar
            </p>
            <button
                onClick={() => {
                    onComplete?.(createdCount);
                    onClose?.();
                }}
                className="mt-6 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
                Done
            </button>
        </div>
    );

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-text-primary">Import Syllabus</h2>
                        <p className="text-xs text-text-secondary">
                            Add tasks from your calendar
                        </p>
                    </div>
                </div>
                {onClose && step !== 'importing' && (
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-text-secondary" />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                {step === 'input' && renderInput()}
                {step === 'preview' && renderPreview()}
                {step === 'importing' && renderImporting()}
                {step === 'complete' && renderComplete()}
            </div>
        </div>
    );
}

// ============================================================================
// MODAL WRAPPER
// ============================================================================

interface SyllabusImportModalProps extends SyllabusImportProps {
    isOpen: boolean;
}

export function SyllabusImportModal({ isOpen, ...props }: SyllabusImportModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <SyllabusImport {...props} />
        </div>
    );
}

export default SyllabusImport;
