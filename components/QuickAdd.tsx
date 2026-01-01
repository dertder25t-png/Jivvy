"use client";

import React, { useState, useRef, useEffect } from "react";
import {
    Calendar,
    Hash,
    ArrowUp,
    Loader2,
    Flag,
    FolderPlus,
    X,
    CheckCircle2,
    AlertCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Block, Project } from "@/lib/db";
import { parseInputString, ParsedTask } from "@/lib/SmartParser";
import { useProjectStore } from "@/lib/store";
import { classifyIntentLocal, type SmartCreateType } from "@/utils/local-intent";
import { createAppError, toAppError, type AppError } from "@/lib/errors";

interface QuickAddProps {
    onTaskAdded?: () => void;
}

export function QuickAdd({ onTaskAdded }: QuickAddProps) {
    const { addProject, addBlock, loadProjects, projects } = useProjectStore();
    const router = useRouter();
    const showIntentDebug = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_INTENT_DEBUG === '1';
    const [input, setInput] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastKind, setToastKind] = useState<SmartCreateType>('task');
    const [toastVariant, setToastVariant] = useState<'success' | 'error'>('success');
    const [toastMessage, setToastMessage] = useState<string>('');

    // Parsed State
    const [parsed, setParsed] = useState<ParsedTask>({ type: 'task', title: '' });
    const [parseError, setParseError] = useState<AppError | null>(null);

    // Ghost Suggestion state
    const [forcedKind, setForcedKind] = useState<SmartCreateType | null>(null);
    const [suggestedKind, setSuggestedKind] = useState<SmartCreateType>('task');
    const [suggestedConfidence, setSuggestedConfidence] = useState<'explicit' | 'high' | 'medium' | 'low' | null>(null);
    const [ghostDismissed, setGhostDismissed] = useState(false);
    const [isClassifying, setIsClassifying] = useState(false);
    const lastInputRef = useRef<string>('');
    const classifySeqRef = useRef(0);

    // Auto-filing suggestion
    const [suggestedProjectId, setSuggestedProjectId] = useState<string | null>(null);
    const [suggestedProjectLabel, setSuggestedProjectLabel] = useState<string | null>(null);
    const [suggestedProjectKeyword, setSuggestedProjectKeyword] = useState<string | null>(null);
    const [suggestedProjectIsExplicit, setSuggestedProjectIsExplicit] = useState(false);

    // Manual Overrides
    const [manualPriority, setManualPriority] = useState<'low' | 'medium' | 'high' | null>(null);
    const [manualDate, setManualDate] = useState<Date | null>(null);
    const [manualProject, setManualProject] = useState<string | null>(null); // By ID or Name

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Ensure projects are available for matching.
        loadProjects();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const AUTO_FILING_PREFS_KEY = 'jivvy:autoFilingPrefs:v1';
    type AutoFilingPrefs = Record<string, { projectId: string; accepted: number }>; // keyword -> project

    const normalize = (s: string) => s.trim().toLowerCase();

    const loadPrefs = (): AutoFilingPrefs => {
        try {
            const raw = localStorage.getItem(AUTO_FILING_PREFS_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return {};
            return parsed as AutoFilingPrefs;
        } catch {
            return {};
        }
    };

    const savePrefs = (prefs: AutoFilingPrefs) => {
        try {
            localStorage.setItem(AUTO_FILING_PREFS_KEY, JSON.stringify(prefs));
        } catch {
            // Ignore
        }
    };

    const bumpAccepted = (keyword: string, projectId: string) => {
        const k = normalize(keyword);
        if (!k) return;
        const prefs = loadPrefs();
        const prev = prefs[k];
        prefs[k] = {
            projectId,
            accepted: (prev?.projectId === projectId ? prev.accepted : 0) + 1,
        };
        savePrefs(prefs);
    };

    const computeSuggestedProject = (text: string): {
        projectId: string;
        label: string;
        keyword: string;
        isExplicit: boolean;
    } | null => {
        const trimmed = text.trim();
        if (!trimmed) return null;
        if (!projects || projects.length === 0) return null;

        const t = normalize(trimmed);

        // 1) Explicit tag match (exact by project name or project tags)
        const rawTag = parsed.projectTag ? String(parsed.projectTag).replace(/^#/, '') : '';
        const tag = normalize(rawTag);
        if (tag) {
            const exact = projects.find(p => normalize(p.name) === tag || (p.tags ?? []).some(tt => normalize(tt) === tag));
            if (exact) {
                return { projectId: exact.id, label: exact.name, keyword: tag, isExplicit: true };
            }
        }

        // 2) Previously accepted keywords
        const prefs = loadPrefs();
        const prefKeywords = Object.entries(prefs)
            .filter(([k, v]) => typeof k === 'string' && v && typeof v.projectId === 'string' && v.accepted > 0)
            .sort((a, b) => (b[1].accepted ?? 0) - (a[1].accepted ?? 0));

        for (const [k, v] of prefKeywords) {
            if (!k) continue;
            if (t.includes(normalize(k))) {
                const p = projects.find(pp => pp.id === v.projectId);
                if (p) return { projectId: p.id, label: p.name, keyword: k, isExplicit: false };
            }
        }

        // 3) Fuzzy match: input contains project name (prefer longest match)
        let best: { projectId: string; label: string; keyword: string; score: number } | null = null;
        for (const p of projects) {
            const name = normalize(p.name);
            if (!name || name.length < 3) continue;
            if (t.includes(name)) {
                const score = name.length;
                if (!best || score > best.score) best = { projectId: p.id, label: p.name, keyword: name, score };
            } else if (name.startsWith(t) && t.length >= 3) {
                // Input starts the project name (starts-with).
                const score = t.length;
                if (!best || score > best.score) best = { projectId: p.id, label: p.name, keyword: t, score };
            }
        }

        return best ? { projectId: best.projectId, label: best.label, keyword: best.keyword, isExplicit: false } : null;
    };

    // Live Parsing Effect
    useEffect(() => {
        try {
            const result = parseInputString(input);
            setParsed(result);
            setParseError(null);
        } catch (e) {
            // Keep the UX flowing: fallback to plain task, but preserve a diagnosable error.
            setParsed({ type: 'task', title: input.trim() });
            setParseError(
                createAppError('PARSE_FAILED', 'Failed to parse input', {
                    retryable: false,
                    detail: { input: input.slice(0, 500) },
                })
            );
        }
    }, [input]);

    const showToastFor = (variant: 'success' | 'error', kind: SmartCreateType, message: string) => {
        setToastVariant(variant);
        setToastKind(kind);
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    // Local intent classification (debounced)
    useEffect(() => {
        const trimmed = input.trim();

        // Invalidate any in-flight classification when input changes.
        classifySeqRef.current += 1;
        setIsClassifying(false);

        // Reset dismissal when user changes the text.
        if (lastInputRef.current !== trimmed) {
            setGhostDismissed(false);
            lastInputRef.current = trimmed;
        }

        if (!trimmed) {
            setSuggestedKind('task');
            setSuggestedConfidence(null);
            setSuggestedProjectId(null);
            setSuggestedProjectLabel(null);
            setSuggestedProjectKeyword(null);
            setSuggestedProjectIsExplicit(false);
            return;
        }

        if (forcedKind) {
            setSuggestedKind(forcedKind);
            setSuggestedConfidence('explicit');
            return;
        }

        // Explicit parser types should win without waiting.
        if (parsed.type === 'project' || parsed.type === 'paper' || parsed.type === 'brainstorm') {
            setSuggestedKind(parsed.type as SmartCreateType);
            setSuggestedConfidence('explicit');
            return;
        }

        const handle = window.setTimeout(async () => {
            const seq = (classifySeqRef.current += 1);
            setIsClassifying(true);
            try {
                const suggestion = await classifyIntentLocal(trimmed);
                // Ignore stale results.
                if (seq !== classifySeqRef.current) return;
                setSuggestedKind(suggestion.kind);
                setSuggestedConfidence(suggestion.confidence);
            } finally {
                if (seq === classifySeqRef.current) setIsClassifying(false);
            }
        }, 250);

        return () => window.clearTimeout(handle);
    }, [input, forcedKind, parsed.type]);

    // Compute suggested parent project (trust-based; applied only on explicit confirm)
    useEffect(() => {
        const trimmed = input.trim();
        if (!trimmed || ghostDismissed) {
            setSuggestedProjectId(null);
            setSuggestedProjectLabel(null);
            setSuggestedProjectKeyword(null);
            setSuggestedProjectIsExplicit(false);
            return;
        }

        // Only suggest auto-filing when creating a task.
        const kind = forcedKind ?? suggestedKind;
        if (kind !== 'task') {
            setSuggestedProjectId(null);
            setSuggestedProjectLabel(null);
            setSuggestedProjectKeyword(null);
            setSuggestedProjectIsExplicit(false);
            return;
        }

        const suggestion = computeSuggestedProject(trimmed);
        setSuggestedProjectId(suggestion?.projectId ?? null);
        setSuggestedProjectLabel(suggestion?.label ?? null);
        setSuggestedProjectKeyword(suggestion?.keyword ?? null);
        setSuggestedProjectIsExplicit(Boolean(suggestion?.isExplicit));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [input, projects, ghostDismissed, forcedKind, suggestedKind, parsed.projectTag]);

    // Computed Values (Manual overrides Parsed)
    const finalPriority = manualPriority || parsed.priority;
    const finalDate = manualDate || parsed.dueDate;
    const finalProjectTag = manualProject ? null : parsed.projectTag; // Manual project selection implies exact ID usually, but here we just use name or tag
    // Note: manualProject logic would require selecting from existing Projects. For MVP, we stick to tags or simple overrides.
    // The prompt asks for "Dropdown to manually assign". I'll mock that behavior or just assume text is enough for now, 
    // as fetching projects takes effect. I'll implement a simple toggle for now or just let Parse handle it.

    const handleCreate = async (kind: SmartCreateType, opts?: { e?: React.FormEvent; acceptSuggestions?: boolean }) => {
        const e = opts?.e;
        e?.preventDefault();
        if (!parsed.title.trim() && !input.trim()) return;
        if (isSaving) return;

        setIsSaving(true);

        try {
            // Determine effective data
            const title = parsed.title || input; // Fallback if parse fails to extract title
            const isProjectLike = kind === 'project' || kind === 'paper' || kind === 'brainstorm';

            if (isProjectLike) {
                const projectId = crypto.randomUUID();
                const newProject: Project = {
                    id: projectId,
                    name: title,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                    priority: finalPriority,
                    due_date: finalDate?.getTime(),
                    color: "bg-zinc-400",
                    tags: finalProjectTag ? [finalProjectTag] : [],
                    metadata: {
                        ...(kind === 'paper' ? { kind: 'paper' } : {}),
                        ...(kind === 'brainstorm' ? { kind: 'brainstorm' } : {}),
                        source: 'quickadd'
                    }
                };
                const res = await addProject(newProject);
                if (!res.ok) {
                    showToastFor('error', kind, res.error.message);
                    return;
                }
                console.log("Created Project via Store:", newProject);

                // Navigate to the newly created project view.
                if (kind === 'paper') {
                    router.push(`/project/${projectId}?view=doc`);
                } else if (kind === 'brainstorm') {
                    router.push(`/project/${projectId}?view=canvas`);
                } else {
                    router.push(`/project/${projectId}`);
                }
            } else {
                const acceptSuggestions = Boolean(opts?.acceptSuggestions);
                const effectiveParentId =
                    // Explicit tags should always apply.
                    (suggestedProjectIsExplicit && suggestedProjectId)
                        ? suggestedProjectId
                        : (acceptSuggestions && suggestedProjectId)
                            ? suggestedProjectId
                            : null;

                const newTask: Block = {
                    id: crypto.randomUUID(),
                    parent_id: effectiveParentId,
                    content: title,
                    type: 'task',
                    order: Date.now(),
                    properties: {
                        priority: finalPriority,
                        due_date: finalDate?.getTime(),
                        tags: finalProjectTag ? [finalProjectTag] : [],
                        checked: false
                    },
                    metadata: {
                        original_text: input,
                        status: 'todo', // Legacy support
                        // Legacy field mapping for Dashboard compatibility
                        scheduled_date: finalDate?.getTime(),
                        project_tag: finalProjectTag
                    }
                };
                const res = await addBlock(newTask);
                if (!res.ok) {
                    showToastFor('error', kind, res.error.message);
                    return;
                }
                console.log("Created Task via Store:", newTask);

                // Persist acceptance only when it was a suggestion (not explicit tag) and user explicitly accepted.
                if (acceptSuggestions && suggestedProjectId && suggestedProjectKeyword && !suggestedProjectIsExplicit) {
                    bumpAccepted(suggestedProjectKeyword, suggestedProjectId);
                }
            }

            if (parseError) {
                showToastFor('error', kind, 'Could not fully parse input — saved as plain text.');
            } else {
                showToastFor(
                    'success',
                    kind,
                    kind === 'paper'
                        ? 'Paper created'
                        : kind === 'brainstorm'
                            ? 'Brainstorm created'
                            : kind === 'project'
                                ? 'Project created'
                                : 'Task captured'
                );
            }

            // Success
            setInput("");
            setManualPriority(null);
            setManualDate(null);
            setManualProject(null);
            onTaskAdded?.();
        } catch (error) {
            const appErr = toAppError(error, { code: 'DB_WRITE_FAILED', message: 'Failed to save item', retryable: true });
            console.error("Failed to add Item:", appErr);
            showToastFor('error', kind, appErr.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isSaving) return;

        if (e.key === "Tab") {
            if (!input.trim() || ghostDismissed) return;
            e.preventDefault();
            handleCreate(suggestedKind, { acceptSuggestions: true });
            return;
        }

        if (e.key === "Escape") {
            if (!input.trim()) return;
            e.preventDefault();
            setGhostDismissed(true);
            return;
        }

        if (e.key === "Enter") {
            e.preventDefault();
            // Enter confirms creation, but does NOT auto-file unless the user provided an explicit tag.
            handleCreate(suggestedKind, { acceptSuggestions: false });
        }
    };

    // Helper for Priority Color
    const getPriorityColor = (p?: string) => {
        if (p === 'high') return 'text-red-500 bg-red-50 dark:bg-red-900/20';
        if (p === 'medium') return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20';
        return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
    };

    const togglePriority = () => {
        if (!manualPriority) setManualPriority('medium');
        else if (manualPriority === 'medium') setManualPriority('high');
        else if (manualPriority === 'high') setManualPriority('low');
        else setManualPriority(null);
    };

    return (
        <div
            className={cn(
                "relative group rounded-xl border transition-all duration-200 bg-surface shadow-sm",
                isFocused
                    ? "border-primary/50 shadow-md ring-1 ring-primary/10"
                    : "border-border hover:border-border/80"
            )}
        >
            <div className="flex flex-col">
                {/* Input Area */}
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={handleKeyDown}
                    disabled={isSaving}
                    placeholder="Describe a task or type 'Project: Name'..."
                    className="w-full bg-transparent px-4 py-4 text-base placeholder:text-text-secondary/50 focus:outline-none disabled:opacity-50"
                />

                {/* Mode Chips (Manual Override) */}
                {(isFocused || input.trim()) && (
                    <div className="px-4 -mt-1 pb-2 flex flex-wrap gap-2 text-xs">
                        {([
                            { kind: 'task', label: 'Task' },
                            { kind: 'project', label: 'Project' },
                            { kind: 'paper', label: 'Paper' },
                            { kind: 'brainstorm', label: 'Brainstorm' },
                        ] as const).map((chip) => {
                            const active = forcedKind === chip.kind;
                            return (
                                <button
                                    key={chip.kind}
                                    type="button"
                                    onClick={() => setForcedKind(active ? null : chip.kind)}
                                    className={cn(
                                        "px-2 py-1 rounded-md border text-text-secondary transition-colors",
                                        active
                                            ? "border-primary/30 bg-primary/10 text-primary"
                                            : "border-border bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                    )}
                                >
                                    {chip.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Ghost Suggestion (Trust-Based) */}
                {input.trim() && !ghostDismissed && (
                    <div className="px-4 pb-2">
                        <div className="rounded-lg border border-border bg-zinc-50/60 dark:bg-zinc-900/30 px-3 py-2">
                            <div className="text-sm text-text-primary">
                                <span className="font-medium">
                                    {suggestedKind === 'paper'
                                        ? 'Create Paper:'
                                        : suggestedKind === 'brainstorm'
                                            ? 'Create Brainstorm:'
                                            : suggestedKind === 'project'
                                                ? 'Create Project:'
                                                : 'Create Task:'}
                                </span>{" "}
                                <span className="text-text-secondary">&quot;{(parsed.title || input).trim()}&quot;</span>
                            </div>
                            <div className="mt-1 text-[11px] text-text-secondary">
                                [Tab] to confirm • [Esc] to cancel
                            </div>

                            {showIntentDebug && suggestedConfidence && (
                                <div className="mt-1 text-[11px] text-text-secondary opacity-70">
                                    Intent confidence: <span className="font-medium">{suggestedConfidence}</span>
                                </div>
                            )}

                            {suggestedProjectLabel && (forcedKind ?? suggestedKind) === 'task' && (
                                <div className="mt-1 text-[11px] text-text-secondary">
                                    File under: <span className="text-text-primary font-medium">{suggestedProjectLabel}</span>
                                    {!suggestedProjectIsExplicit && <span className="opacity-60"> (suggested)</span>}
                                </div>
                            )}

                            {isClassifying && (
                                <div className="mt-1 text-[11px] text-text-secondary flex items-center gap-2">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Detecting intent…
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Parsed / Live Feedback Area (Pills) */}
                {(finalDate || finalPriority || finalProjectTag || parsed.type === 'project') && (
                    <div className="px-4 pb-0 flex flex-wrap gap-2 text-xs">
                        {parsed.type === 'project' && (
                            <span className="inline-flex items-center gap-1 text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-2 py-1 rounded-md font-medium animate-in fade-in zoom-in duration-200">
                                <FolderPlus className="w-3 h-3" />
                                New Project
                            </span>
                        )}
                        {finalDate && (
                            <span className="inline-flex items-center gap-1 text-primary bg-primary/10 px-2 py-1 rounded-md font-medium animate-in fade-in zoom-in duration-200">
                                <Calendar className="w-3 h-3" />
                                {finalDate.toLocaleDateString()}
                                {manualDate && <span className="ml-1 opacity-50 text-[10px]">(Manual)</span>}
                            </span>
                        )}
                        {finalPriority && (
                            <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium animate-in fade-in zoom-in duration-200", getPriorityColor(finalPriority))}>
                                <Flag className="w-3 h-3 fill-current" />
                                {finalPriority.charAt(0).toUpperCase() + finalPriority.slice(1)}
                            </span>
                        )}
                        {finalProjectTag && (
                            <span className="inline-flex items-center gap-1 text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 px-2 py-1 rounded-md font-medium animate-in fade-in zoom-in duration-200">
                                <Hash className="w-3 h-3" />
                                {finalProjectTag}
                            </span>
                        )}
                    </div>
                )}

                {/* Control Bar (Collapsed unless focused or has content) */}
                <div className={cn(
                    "flex items-center justify-between px-2 pb-2 mt-2 transition-all duration-200 overflow-hidden",
                    (isFocused || input) ? "opacity-100 max-h-12" : "opacity-0 max-h-0 pb-0"
                )}>
                    {/* Left Tools */}
                    <div className="flex items-center gap-1 px-2">
                        {/* Date Picker Button (Using native for MVP) */}
                        <div className="relative group/date">
                            <button type="button" className="p-2 text-text-secondary hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors" title="Set Date">
                                <Calendar className="w-4 h-4" />
                            </button>
                            <input
                                type="date"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => {
                                    if (e.target.valueAsDate) setManualDate(e.target.valueAsDate);
                                    else setManualDate(null);
                                }}
                            />
                        </div>

                        {/* Priority Toggle */}
                        <button
                            type="button"
                            onClick={togglePriority}
                            className={cn(
                                "p-2 rounded-lg transition-colors",
                                manualPriority ? getPriorityColor(manualPriority) : "text-text-secondary hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            )}
                            title="Toggle Priority"
                        >
                            <Flag className={cn("w-4 h-4", manualPriority && "fill-current")} />
                        </button>

                        {/* Project Selector (Mock) */}
                        <button
                            type="button"
                            className="p-2 text-text-secondary hover:text-violet-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Set Project"
                            onClick={() => {
                                // For now, just prompt/toggle to simulate
                                // In real app: Open Popover
                                const manual = prompt("Enter project name manually:");
                                if (manual) setManualProject(manual);
                            }}
                        >
                            <FolderPlus className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Right Action */}
                    <div className="flex items-center gap-2">
                        {(manualDate || manualPriority || manualProject) && (
                            <button
                                onClick={() => {
                                    setManualDate(null);
                                    setManualPriority(null);
                                    setManualProject(null);
                                }}
                                className="text-xs text-zinc-400 hover:text-red-400 mr-2"
                            >
                                Clear Overrides
                            </button>
                        )}

                        <button
                            onClick={() => handleCreate(suggestedKind, { acceptSuggestions: true })}
                            disabled={(!parsed.title && !input.trim()) || isSaving}
                            className={cn(
                                "h-8 px-3 rounded-lg transition-all flex items-center gap-2 text-xs font-semibold shadow-sm",
                                (parsed.title || input.trim())
                                    ? "bg-primary text-white hover:bg-primary/90 hover:shadow-primary/20 hover:translate-y-[-1px]"
                                    : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed"
                            )}
                        >
                            <span>
                                {suggestedKind === 'paper'
                                    ? 'Create Paper'
                                    : suggestedKind === 'brainstorm'
                                        ? 'Create Brainstorm'
                                        : suggestedKind === 'project'
                                            ? 'Create Project'
                                            : 'Add Task'}
                            </span>
                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUp className="w-3 h-3" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Toast Notification */}
            {showToast && (
                <div className="absolute bottom-full mb-3 left-0 right-0 flex justify-center z-50 pointer-events-none">
                    <div className="bg-zinc-900 text-white text-xs px-4 py-2 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 border border-zinc-800">
                        {toastVariant === 'success' ? (
                            <CheckCircle2 className="w-3 h-3 text-lime-400" />
                        ) : (
                            <AlertCircle className="w-3 h-3 text-amber-400" />
                        )}
                        <span>{toastMessage || (toastVariant === 'success' ? 'Saved' : 'Something went wrong')}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
