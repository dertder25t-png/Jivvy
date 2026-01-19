
"use client";

import React, { useState } from 'react';
import { useSync } from "@/components/providers/SyncProvider";
import { formatDistanceToNow } from "date-fns";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";

export function SyncSettings() {
    const {
        syncMode, setSyncMode,
        driveConnected, driveSyncing, driveLastSync, connectDrive, syncDriveNow,
        convexSyncing
    } = useSync();

    const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
    const tasksCount = useLiveQuery(async () => {
        const taskCount = await db.blocks.where('type').equals('task').count();
        const eventCount = await db.blocks.where('type').equals('event').count();
        return taskCount + eventCount;
    }) || 0;

    return (
        <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm space-y-4">
            <h3 className="font-semibold text-lg">Sync & Storage</h3>

            {/* Mode Switcher */}
            <div className="flex bg-muted p-1 rounded-lg">
                <button
                    onClick={() => setSyncMode('hybrid')}
                    className={`flex-1 py-1 px-3 text-sm rounded-md transition-all ${syncMode === 'hybrid' ? 'bg-background shadow font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    Hybrid (Best)
                </button>
                <button
                    onClick={() => setSyncMode('drive-only')}
                    className={`flex-1 py-1 px-3 text-sm rounded-md transition-all ${syncMode === 'drive-only' ? 'bg-background shadow font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    Drive Only (Private)
                </button>
            </div>

            <div className="text-xs text-muted-foreground">
                {syncMode === 'hybrid'
                    ? "Hybrid Mode: Metadata syncs instantly via Convex. Files stay in your Google Drive."
                    : "Drive Only Mode: All data stays on your device and syncs only to your Google Drive. No Convex connection."}
            </div>

            <hr className="border-border" />

            {/* Convex Status (Only in Hybrid) */}
            {syncMode === 'hybrid' && (
                <div className="flex items-center justify-between text-sm">
                    <span>⚡ Real-Time Sync</span>
                    <span className={convexSyncing ? "text-yellow-500" : "text-green-500"}>
                        {convexSyncing ? "Syncing..." : "Active"}
                    </span>
                </div>
            )}

            {/* Drive Status */}
            <div className="flex items-center justify-between text-sm">
                <span>📁 Google Drive</span>
                <span className={driveConnected ? "text-green-500" : "text-yellow-500"}>
                    {driveConnected ? (driveSyncing ? "Syncing..." : "Connected") : "Disconnected"}
                </span>
            </div>

            {driveLastSync && driveLastSync > 0 && (
                <div className="text-xs text-muted-foreground text-right">
                    Backup: {formatDistanceToNow(driveLastSync, { addSuffix: true })}
                </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex flex-col gap-2">
                {!driveConnected ? (
                    <button
                        onClick={() => connectDrive()}
                        className="px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm transition-colors w-full"
                    >
                        Connect Google Drive
                    </button>
                ) : (
                    <button
                        onClick={() => syncDriveNow()}
                        disabled={driveSyncing}
                        className="px-3 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-50 text-sm transition-colors w-full"
                    >
                        {driveSyncing ? "Backing up..." : "Backup Now"}
                    </button>
                )}
            </div>

            <hr className="border-border" />

            {/* Danger Zone */}
            <div>
                <h4 className="text-xs font-semibold text-red-500 mb-2 uppercase tracking-wider">Danger Zone</h4>

                {/* Delete All Tasks */}
                <div className="mb-2">
                    {deleteConfirmation === 'tasks' ? (
                        <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded">
                            <span className="text-sm font-medium text-red-700 dark:text-red-300 flex-1">
                                Are you sure? This deletes ALL {tasksCount} tasks & events.
                            </span>
                            <button
                                onClick={() => setDeleteConfirmation(null)}
                                className="px-3 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await db.blocks.where('type').equals('task').delete();
                                        await db.blocks.where('type').equals('event').delete();
                                        alert("All tasks and events deleted successfully.");
                                    } catch (e) {
                                        console.error(e);
                                        alert("Error deleting tasks.");
                                    } finally {
                                        setDeleteConfirmation(null);
                                    }
                                }}
                                className="px-3 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                            >
                                Yes, Delete
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setDeleteConfirmation('tasks')}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors border border-red-200 dark:border-red-900/30"
                        >
                            Delete All Tasks & Events
                        </button>
                    )}
                </div>

                {/* Factory Reset */}
                <div>
                    {deleteConfirmation === 'factory' ? (
                        <div className="flex items-center gap-2 p-2 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-800 rounded">
                            <span className="text-sm font-bold text-red-800 dark:text-red-200 flex-1">
                                WARNING: This wipes EVERYTHING.
                            </span>
                            <button
                                onClick={() => setDeleteConfirmation(null)}
                                className="px-3 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await db.delete();
                                        window.location.reload();
                                    } catch (e) {
                                        console.error(e);
                                        alert("Reset failed.");
                                    }
                                }}
                                className="px-3 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                            >
                                CONFIRM RESET
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setDeleteConfirmation('factory')}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors border border-red-200 dark:border-red-900/30"
                        >
                            Factory Reset Database
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
