"use client";

import { AppShell } from "@/components/layout/AppShell";
import { SmartTaskInput } from "@/components/SmartTaskInput";
import { Plus } from "lucide-react";

export default function Home() {
    return (
        <AppShell>
            <div className="space-y-6">

                {/* Task Input Section */}
                <section>
                    <SmartTaskInput />
                </section>

                {/* Task List Placeholder */}
                <div className="space-y-1">
                    {/* Example Task Items */}
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="group flex items-start gap-3 p-2 bg-surface hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-md transition-all cursor-pointer border border-transparent hover:border-border/50">
                            <button className="mt-1 w-5 h-5 rounded-full border-2 border-text-secondary/30 hover:border-primary transition-colors"></button>
                            <div className="flex-1">
                                <p className="text-sm text-text-primary">Review design mockups for the new project {i}</p>
                                <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-2">
                                    <span className="text-primary">Today</span>
                                    <span>•</span>
                                    <span>#Work</span>
                                </p>
                            </div>
                        </div>
                    ))}

                    {/* Add Task Button (Bottom) */}
                    <button className="flex items-center gap-2 text-text-secondary hover:text-primary mt-4 text-sm font-medium transition-colors group">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20">
                            <Plus className="w-4 h-4" />
                        </div>
                        <span>Add task</span>
                    </button>
                </div>

            </div>
        </AppShell>
    );
}
