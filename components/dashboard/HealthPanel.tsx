'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ensureDbReady } from '@/lib/db';
import { checkStorageSpace, isModelCached, getModelCacheStatus, type AIMode } from '@/utils/local-llm';
import {
    Database,
    Cpu,
    HardDrive,
    CheckCircle2,
    XCircle,
    AlertCircle,
    RefreshCw,
    Loader2,
    ChevronDown,
    ChevronUp,
    Copy,
    Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

type HealthStatus = 'ok' | 'warning' | 'error' | 'unknown';

interface HealthCheck {
    name: string;
    status: HealthStatus;
    message: string;
    details?: Record<string, unknown>;
}

interface HealthPanelProps {
    className?: string;
}

// ============================================================================
// HEALTH CHECK FUNCTIONS
// ============================================================================

async function checkDatabase(): Promise<HealthCheck> {
    try {
        const result = await ensureDbReady();
        if (result.ok) {
            return {
                name: 'Database',
                status: 'ok',
                message: 'IndexedDB is ready',
            };
        }
        return {
            name: 'Database',
            status: 'error',
            message: result.error.message,
            details: { code: result.error.code },
        };
    } catch (e) {
        return {
            name: 'Database',
            status: 'error',
            message: 'Failed to check database',
            details: { error: e instanceof Error ? e.message : 'Unknown error' },
        };
    }
}

async function checkStorage(): Promise<HealthCheck> {
    try {
        const { available, freeSpaceMB, freeSpaceFormatted, warning } = await checkStorageSpace();

        if (!available) {
            return {
                name: 'Storage',
                status: 'error',
                message: 'Insufficient storage space',
                details: { freeSpaceMB, freeSpaceFormatted },
            };
        }

        if (warning) {
            return {
                name: 'Storage',
                status: 'warning',
                message: warning,
                details: { freeSpaceMB, freeSpaceFormatted },
            };
        }

        return {
            name: 'Storage',
            status: 'ok',
            message: `${freeSpaceFormatted} available`,
            details: { freeSpaceMB, freeSpaceFormatted },
        };
    } catch (e) {
        return {
            name: 'Storage',
            status: 'unknown',
            message: 'Could not check storage',
            details: { error: e instanceof Error ? e.message : 'Unknown error' },
        };
    }
}

async function checkModelCache(): Promise<HealthCheck> {
    try {
        const status = await getModelCacheStatus();
        const quickCached = status.quick.cached;
        const thoroughCached = status.thorough.cached;
        const totalSize = status.quick.sizeMB + status.thorough.sizeMB;

        if (quickCached || thoroughCached) {
            const models: string[] = [];
            if (quickCached) models.push('Quick');
            if (thoroughCached) models.push('Thorough');

            return {
                name: 'AI Models',
                status: 'ok',
                message: `${models.join(' & ')} model${models.length > 1 ? 's' : ''} cached`,
                details: { quickCached, thoroughCached, totalSizeMB: totalSize },
            };
        }

        return {
            name: 'AI Models',
            status: 'warning',
            message: 'No AI models cached',
            details: { quickCached, thoroughCached },
        };
    } catch (e) {
        return {
            name: 'AI Models',
            status: 'unknown',
            message: 'Could not check model cache',
            details: { error: e instanceof Error ? e.message : 'Unknown error' },
        };
    }
}

async function checkWorkers(): Promise<HealthCheck> {
    try {
        // Check if Workers are supported
        if (typeof Worker === 'undefined') {
            return {
                name: 'Workers',
                status: 'error',
                message: 'Web Workers not supported',
            };
        }

        // Workers are available
        return {
            name: 'Workers',
            status: 'ok',
            message: 'Web Workers available',
        };
    } catch (e) {
        return {
            name: 'Workers',
            status: 'unknown',
            message: 'Could not check workers',
            details: { error: e instanceof Error ? e.message : 'Unknown error' },
        };
    }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function HealthPanel({ className }: HealthPanelProps) {
    const [checks, setChecks] = useState<HealthCheck[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const runChecks = useCallback(async () => {
        setLoading(true);
        try {
            const results = await Promise.all([
                checkDatabase(),
                checkStorage(),
                checkModelCache(),
                checkWorkers(),
            ]);
            setChecks(results);
        } catch (e) {
            console.error('[HealthPanel] Error running checks:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        runChecks();
    }, [runChecks]);

    // Compute overall status
    const overallStatus: HealthStatus = checks.some((c) => c.status === 'error')
        ? 'error'
        : checks.some((c) => c.status === 'warning')
        ? 'warning'
        : checks.some((c) => c.status === 'unknown')
        ? 'unknown'
        : 'ok';

    const statusConfig = {
        ok: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', label: 'All systems operational' },
        warning: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Some issues detected' },
        error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Issues detected' },
        unknown: { icon: AlertCircle, color: 'text-zinc-400', bg: 'bg-zinc-50 dark:bg-zinc-800', label: 'Status unknown' },
    };

    const StatusIcon = statusConfig[overallStatus].icon;

    // Copy debug info
    const copyDebugInfo = useCallback(() => {
        const info = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            checks: checks.map((c) => ({
                name: c.name,
                status: c.status,
                message: c.message,
                details: c.details,
            })),
        };

        navigator.clipboard.writeText(JSON.stringify(info, null, 2)).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [checks]);

    if (loading && checks.length === 0) {
        return (
            <div className={cn("p-4 rounded-xl border border-border", className)}>
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
                </div>
            </div>
        );
    }

    return (
        <div className={cn("rounded-xl border border-border overflow-hidden", className)}>
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className={cn(
                    "w-full flex items-center justify-between p-4 transition-colors",
                    statusConfig[overallStatus].bg
                )}
            >
                <div className="flex items-center gap-3">
                    <StatusIcon className={cn("w-5 h-5", statusConfig[overallStatus].color)} />
                    <div className="text-left">
                        <h3 className="font-medium text-text-primary text-sm">System Health</h3>
                        <p className="text-xs text-text-secondary">{statusConfig[overallStatus].label}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {loading && <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />}
                    {expanded ? (
                        <ChevronUp className="w-4 h-4 text-text-secondary" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-text-secondary" />
                    )}
                </div>
            </button>

            {/* Details */}
            {expanded && (
                <div className="p-4 space-y-3 bg-white dark:bg-zinc-900">
                    {checks.map((check, idx) => {
                        const CheckIcon = statusConfig[check.status].icon;
                        return (
                            <div
                                key={check.name}
                                className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
                            >
                                <CheckIcon className={cn("w-4 h-4 mt-0.5", statusConfig[check.status].color)} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-sm text-text-primary">
                                            {check.name}
                                        </span>
                                        <span className={cn(
                                            "text-xs font-medium px-2 py-0.5 rounded-full",
                                            check.status === 'ok' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                            check.status === 'warning' && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                                            check.status === 'error' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                                            check.status === 'unknown' && "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                                        )}>
                                            {check.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <p className="text-xs text-text-secondary mt-0.5">
                                        {check.message}
                                    </p>
                                </div>
                            </div>
                        );
                    })}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                        <button
                            onClick={runChecks}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                            Refresh
                        </button>
                        <button
                            onClick={copyDebugInfo}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5" />
                                    Copy debug info
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default HealthPanel;
