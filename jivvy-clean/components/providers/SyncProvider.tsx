"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useDriveSync } from "@/lib/hooks/useDriveSync";
import { useLectureOffloader } from "@/lib/hooks/useLectureOffloader";
import { useConvexSync } from "@/lib/sync/convex-sync";

export type SyncMode = 'hybrid' | 'drive-only';

interface SyncContextType {
    syncMode: SyncMode;
    setSyncMode: (mode: SyncMode) => void;

    // Drive State
    driveSyncing: boolean;
    driveLastSync: number | null;
    driveError: string | null;
    driveConnected: boolean;
    connectDrive: () => Promise<string | undefined>;
    syncDriveNow: () => Promise<void>;

    // Convex State
    convexSyncing: boolean;
    syncConvexNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType>({
    syncMode: 'hybrid',
    setSyncMode: () => { },
    driveSyncing: false,
    driveLastSync: null,
    driveError: null,
    driveConnected: false,
    connectDrive: async () => undefined,
    syncDriveNow: async () => { },
    convexSyncing: false,
    syncConvexNow: async () => { },
});

export const useSync = () => useContext(SyncContext);

// Internal component to run the offloader hook within the context
function LectureOffloaderRunner() {
    useLectureOffloader();
    return null;
}

export function SyncProvider({ children }: { children: ReactNode }) {
    const [syncMode, setSyncModeState] = useState<SyncMode>('hybrid');

    // Load persisted mode
    useEffect(() => {
        const saved = localStorage.getItem('jivvy_sync_mode');
        if (saved === 'hybrid' || saved === 'drive-only') {
            setSyncModeState(saved as SyncMode);
        }
    }, []);

    const setSyncMode = (mode: SyncMode) => {
        setSyncModeState(mode);
        localStorage.setItem('jivvy_sync_mode', mode);
    };

    // Drive Sync (Always available, acting as Backup/Asset Store)
    const driveObj = useDriveSync();

    // Convex Sync (Only active in Hybrid mode)
    // We modify useConvexSync to respect a flag
    const convexEnabled = syncMode === 'hybrid';
    const convexObj = useConvexSync(convexEnabled);

    return (
        <SyncContext.Provider value={{
            syncMode,
            setSyncMode,
            driveSyncing: driveObj.isSyncing,
            driveLastSync: driveObj.lastSyncTime,
            driveError: driveObj.error,
            driveConnected: driveObj.isConnected,
            connectDrive: driveObj.connectDrive,
            syncDriveNow: driveObj.syncNow,
            convexSyncing: convexObj.isSyncing,
            syncConvexNow: convexObj.syncNow
        }}>
            <LectureOffloaderRunner />
            {children}
        </SyncContext.Provider>
    );
}
