'use client';

import React from 'react';
import { Activity, Archive, CheckCircle2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsRowProps {
    todayCount: number;
    completedToday: number;
    inboxCount: number;
}

export function StatsRow({ todayCount, completedToday, inboxCount }: StatsRowProps) {
    // Capacity calculation (Assumed daily capacity of 8 tasks for demo)
    const dailyCapacity = 8;
    const loadPercentage = Math.min(100, Math.round((todayCount / dailyCapacity) * 100));

    // Streak/Velocity (Mocked for now, or just use completedToday)
    const velocity = completedToday;

    const StatCard = ({
        label,
        value,
        icon: Icon,
        colorClass,
        subComponent
    }: {
        label: string;
        value: string | number;
        icon: any;
        colorClass: string;
        subComponent?: React.ReactNode;
    }) => (
        <div className="flex flex-col p-3 rounded-xl bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/50 backdrop-blur-sm shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/80">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</span>
                <Icon className={cn("w-3.5 h-3.5", colorClass)} />
            </div>
            <div className="flex items-end justify-between gap-2">
                <span className="text-xl font-black text-zinc-800 dark:text-zinc-100 leading-none">{value}</span>
                {subComponent}
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 w-full">
            {/* Focus Widget */}
            <StatCard
                label="Today's Focus"
                value={todayCount}
                icon={Zap}
                colorClass="text-amber-500"
                subComponent={<span className="text-[10px] text-zinc-500 font-medium mb-0.5">Tasks Due</span>}
            />

            {/* Load Widget */}
            <StatCard
                label="Daily Load"
                value={`${loadPercentage}%`}
                icon={Activity}
                colorClass="text-blue-500"
                subComponent={
                    <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-1">
                        <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${loadPercentage}%` }}
                        />
                    </div>
                }
            />

            {/* Velocity Widget */}
            <StatCard
                label="Velocity"
                value={velocity}
                icon={CheckCircle2}
                colorClass="text-green-500"
                subComponent={<span className="text-[10px] text-zinc-500 font-medium mb-0.5">Completed</span>}
            />

            {/* Inbox Widget */}
            <StatCard
                label="Inbox"
                value={inboxCount}
                icon={Archive}
                colorClass="text-purple-500"
                subComponent={<span className="text-[10px] text-zinc-500 font-medium mb-0.5">Process</span>}
            />
        </div>
    );
}
