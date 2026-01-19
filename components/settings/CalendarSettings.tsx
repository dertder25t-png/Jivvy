
"use client";

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { syncSource, deleteSourceEvents } from '@/lib/import-manager';
import { Trash2, RefreshCw, Plus, Calendar, Eraser } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export function CalendarSettings() {
    const sources = useLiveQuery(() => db.calendar_sources.toArray()) || [];
    const [newUrl, setNewUrl] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [syncingMap, setSyncingMap] = useState<Record<string, boolean>>({});

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUrl) return;

        setIsAdding(true);
        try {
            // Basic validation
            let name = "New Calendar";

            // Try to extract name from URL or generic
            if (newUrl.includes("canvas")) name = "Canvas Calendar";
            if (newUrl.includes("google")) name = "Google Calendar";

            await db.calendar_sources.add({
                id: uuidv4(),
                userId: 'local', // Or use auth context if available
                url: newUrl,
                name: name,
                last_synced_at: 0,
                updated_at: Date.now(),
                sync_status: 'dirty'
            });
            setNewUrl('');
        } catch (err) {
            console.error(err);
            alert("Failed to add source");
        } finally {
            setIsAdding(false);
        }
    };

    const handleSync = async (source: any) => {
        setSyncingMap(prev => ({ ...prev, [source.id]: true }));
        try {
            const result = await syncSource(source);
            if (result.success) {
                await db.calendar_sources.update(source.id, {
                    last_synced_at: Date.now(),
                    updated_at: Date.now(),
                    sync_status: 'dirty'
                });
                // Optional: Toast success
            } else {
                alert("Sync failed: " + (result.error as any)?.message);
            }
        } catch (e) {
            console.error(e);
            alert("Sync error");
        } finally {
            setSyncingMap(prev => ({ ...prev, [source.id]: false }));
        }
    };

    const handleClearEvents = async (id: string, name: string) => {
        if (confirm(`Remove all imported tasks/events from "${name}"? The calendar source will remain.`)) {
            try {
                const count = await deleteSourceEvents(id);
                // Also reset sync time?
                await db.calendar_sources.update(id, {
                    last_synced_at: 0
                });
                alert(`Removed ${count} imported items.`);
            } catch (e) {
                console.error(e);
                alert("Failed to clear events.");
            }
        }
    };

    const handleDelete = async (id: string, name: string) => {
        const count = await db.blocks.filter(b => b.metadata?.source_id === id).count();
        if (confirm(`Delete "${name}" and REMOVE ALL ${count} imported items?`)) {
            await deleteSourceEvents(id);
            await db.calendar_sources.delete(id);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-lg">Smart Import</h3>
            </div>

            <div className="text-sm text-zinc-500 mb-4">
                Import assignments and events from Canvas, Google Calendar, or any ICS/WebCal feed.
            </div>

            {/* List */}
            <div className="space-y-3">
                {sources.map(source => (
                    <div key={source.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700">
                        <div className="flex-1 overflow-hidden mr-4">
                            <div className="font-medium text-sm truncate">{source.name}</div>
                            <div className="text-xs text-zinc-400 truncate">{source.url}</div>
                            {source.last_synced_at ? (
                                <div className="text-[10px] text-zinc-400 mt-1">
                                    Last synced: {new Date(source.last_synced_at).toLocaleString()}
                                </div>
                            ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleSync(source)}
                                disabled={syncingMap[source.id]}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors disabled:opacity-50"
                                title="Sync Now"
                            >
                                <RefreshCw className={`w-4 h-4 ${syncingMap[source.id] ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => handleClearEvents(source.id, source.name)}
                                className="p-2 text-amber-500 hover:bg-amber-100 rounded-full transition-colors"
                                title="Clear Imported Events (Keep Source)"
                            >
                                <Eraser className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => handleDelete(source.id, source.name)}
                                className="p-2 text-red-500 hover:bg-red-100 rounded-full transition-colors"
                                title="Remove Source & Events"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {sources.length === 0 && (
                    <div className="text-center py-6 text-zinc-400 text-sm border border-dashed border-zinc-300 rounded-md">
                        No calendars added yet.
                    </div>
                )}
            </div>

            {/* Add New */}
            <form onSubmit={handleAdd} className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-sm font-medium mb-2">Add Calendar URL</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        placeholder="Paste webcal:// or https://...ics"
                        className="flex-1 p-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="submit"
                        disabled={isAdding || !newUrl}
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                        {isAdding ? 'Adding...' : <><Plus className="w-4 h-4" /> Add</>}
                    </button>
                </div>
                <p className="text-xs text-zinc-400 mt-2">
                    Supports Canvas feeds, Google Calendar (Secret address in iCal format), and standard ICS files.
                </p>
            </form>
        </div>
    );
}
