"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { useProjectStore } from "@/lib/store";
import { useEffect } from "react";

export default function TodayPage() {
    const { setDashboardView } = useProjectStore();

    useEffect(() => {
        setDashboardView('today');
    }, [setDashboardView]);

    return (
        <AppShell>
            <Dashboard />
        </AppShell>
    );
}
