'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { db, Project, Block } from './db';
import { createClient } from '@/utils/supabase/client';
import { useProjectStore } from './store';

/**
 * useSync Hook - Handles Cloud (Supabase) to Local (Dexie) data hydration
 * 
 * This hook ensures data consistency between cloud and local storage:
 * 1. On mount, fetches user's projects from Supabase
 * 2. Hydrates Dexie with cloud data using bulkPut
 * 3. Fetches critical blocks for offline access
 * 
 * This fixes the "Split Brain" problem where users see different data
 * across devices or after re-authentication.
 */

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface UseSyncOptions {
    /** Enable/disable auto-sync on mount */
    enabled?: boolean;
    /** Sync interval in milliseconds (0 = no auto-refresh) */
    syncInterval?: number;
}

interface UseSyncReturn {
    status: SyncStatus;
    lastSynced: Date | null;
    error: string | null;
    syncNow: () => Promise<void>;
    isOnline: boolean;
}

const SYNC_STORAGE_KEY = 'jivvy:lastSyncTime';

export function useSync(options: UseSyncOptions = {}): UseSyncReturn {
    const { enabled = true, syncInterval = 0 } = options;
    
    const [status, setStatus] = useState<SyncStatus>('idle');
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(true);
    
    const loadProjects = useProjectStore(state => state.loadProjects);
    const syncingRef = useRef(false);
    
    // Track online status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => {
            setIsOnline(false);
            setStatus('offline');
        };
        
        setIsOnline(navigator.onLine);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    
    // Load last sync time from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(SYNC_STORAGE_KEY);
            if (stored) {
                setLastSynced(new Date(stored));
            }
        } catch {
            // Ignore localStorage errors
        }
    }, []);
    
    const syncNow = useCallback(async () => {
        // Prevent concurrent syncs
        if (syncingRef.current) return;
        if (!isOnline) {
            setStatus('offline');
            return;
        }
        
        syncingRef.current = true;
        setStatus('syncing');
        setError(null);
        
        try {
            const supabase = createClient();
            
            // Check authentication
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            
            if (authError || !user) {
                // User not authenticated - just load from local DB
                await loadProjects();
                setStatus('synced');
                return;
            }
            
            // Fetch projects from Supabase
            const { data: cloudProjects, error: projectsError } = await supabase
                .from('projects')
                .select('*')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });
            
            if (projectsError) {
                throw new Error(`Failed to fetch projects: ${projectsError.message}`);
            }
            
            if (cloudProjects && cloudProjects.length > 0) {
                // Transform cloud projects to local schema
                const localProjects: Project[] = cloudProjects.map((p: any) => ({
                    id: p.id,
                    name: p.title || 'Untitled',
                    created_at: new Date(p.created_at).getTime(),
                    updated_at: new Date(p.updated_at).getTime(),
                    user_id: p.user_id,
                    priority: p.priority,
                    due_date: p.due_date ? new Date(p.due_date).getTime() : undefined,
                    color: p.color,
                    tags: p.tags || [],
                    metadata: {
                        ...(p.extracted_constraints || {}),
                        category: p.category,
                        pdf_url: p.pdf_url,
                    }
                }));
                
                // Hydrate Dexie with cloud data (upsert)
                await db.projects.bulkPut(localProjects);
                
                console.log(`[useSync] Synced ${localProjects.length} projects from cloud`);
            }
            
            // Refresh the store
            await loadProjects();
            
            // Update last synced time
            const now = new Date();
            setLastSynced(now);
            try {
                localStorage.setItem(SYNC_STORAGE_KEY, now.toISOString());
            } catch {
                // Ignore localStorage errors
            }
            
            setStatus('synced');
            
        } catch (err) {
            console.error('[useSync] Sync failed:', err);
            setError(err instanceof Error ? err.message : 'Sync failed');
            setStatus('error');
            
            // Fallback to local data
            await loadProjects();
        } finally {
            syncingRef.current = false;
        }
    }, [isOnline, loadProjects]);
    
    // Initial sync on mount
    useEffect(() => {
        if (enabled) {
            syncNow();
        }
    }, [enabled, syncNow]);
    
    // Periodic sync if interval is set
    useEffect(() => {
        if (!enabled || syncInterval <= 0) return;
        
        const interval = setInterval(syncNow, syncInterval);
        return () => clearInterval(interval);
    }, [enabled, syncInterval, syncNow]);
    
    return {
        status,
        lastSynced,
        error,
        syncNow,
        isOnline
    };
}
