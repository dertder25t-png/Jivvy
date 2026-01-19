import { useEffect, useState, useCallback } from 'react';
import { authenticateGoogleDrive, downloadBackupFromDrive, uploadBackupToDrive } from '@/lib/drive';
import { exportToJSON, importFromJSON } from '@/lib/sync/snapshot';

export function useDriveSync() {
    // const { user, isGuest } = useAuth(); // Not used yet
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);

    // Simple way to store token for now. In prod, maybe persist in localStorage to avoid re-login on reload.
    // For this prototype, we'll ask for it if missing.

    const sync = useCallback(async () => {
        if (isSyncing) return;

        // precise "lock" to prevent double runs
        setIsSyncing(true);
        setError(null);

        try {
            const token = accessToken;
            if (!token) {
                // Double check if we can get it or if we should skip
                // For now, if no token, we can't sync.
                // The user needs to manually "Connect Drive" first usually.
                setIsSyncing(false);
                return;
            }

            console.log("☁️ specific: Starting Sync...");

            // 1. Download & Import (Pull)
            try {
                const cloudData = await downloadBackupFromDrive(token);
                if (cloudData) {
                    await importFromJSON(cloudData);
                    console.log("⬇️ Pulled changes from Drive");
                }
            } catch (err: any) {
                // Ignore "No backup found" error, it just means first sync
                if (err.message !== 'No backup found') {
                    console.warn("Pull failed (might be first run):", err);
                }
            }

            // 2. Export & Upload (Push)
            // We always push the full state for this simple "Snapshot" model
            const localData = await exportToJSON();
            await uploadBackupToDrive(token, localData);
            console.log("⬆️ Pushed changes to Drive");

            setLastSyncTime(Date.now());

        } catch (err: any) {
            console.error("Sync Error:", err);
            setError(err.message || "Unknown sync error");
        } finally {
            setIsSyncing(false);
        }
    }, [accessToken, isSyncing]);

    // Manual Connect Function
    const connectDrive = useCallback(async () => {
        try {
            const token = await authenticateGoogleDrive();
            // Store token for background offloading (valid 1 hour typically)
            sessionStorage.setItem('jivvy_google_token', token);

            setAccessToken(token); // Keep existing state update
            // setIsConnected(true); // <--- REMOVED: derived from token
            setLastSyncTime(Date.now()); // This is usually set after a successful sync, not just connection
            setError(null);

            // Initial checks or setups could go here
            return token;
        } catch (err: any) {
            console.error("Drive Auth Failed", err);
            setError(err.message || 'Failed to connect');
            // setIsConnected(false); // <--- REMOVED
            setAccessToken(null); // Clear token on failure
            return undefined;
        }
    }, []);

    // Auto-Sync Interval (e.g. 60 seconds)
    useEffect(() => {
        if (!accessToken) return;

        const intervalId = setInterval(() => {
            sync();
        }, 60 * 1000); // 60 seconds

        return () => clearInterval(intervalId);
    }, [accessToken, sync]);

    return {
        isSyncing,
        lastSyncTime,
        error,
        isConnected: !!accessToken,
        connectDrive,
        syncNow: sync
    };
}
