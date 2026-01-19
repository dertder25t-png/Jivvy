'use client';

import { TaskDashboard } from '@/components/dashboard/TaskDashboard';
import { useEffect } from 'react';
import { db } from '@/lib/db';

export default function InboxPage() {
    const inboxId = "inbox";

    useEffect(() => {
        // Ensure inbox project exists
        db.projects.put({
            id: inboxId,
            title: "Inbox",
            created_at: 0,
            updated_at: Date.now(),
            sync_status: 'clean',
            is_archived: false
        });
    }, []);

    return (
        <div className="h-full bg-zinc-50 dark:bg-zinc-950">
            <TaskDashboard view="inbox" />
        </div>
    );
}
