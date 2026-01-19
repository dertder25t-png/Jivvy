'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { SourceDrawer } from "@/components/workspace/SourceDrawer";
import { RightSidebar } from "@/components/workspace/RightSidebar";
// import { useStore } from "@/lib/store";

const Sidebar = dynamic(() => import('@/components/layout/Sidebar').then(mod => mod.Sidebar), { ssr: false });

export function AppLayout({ children }: { children: React.ReactNode }) {
    // const store = useStore(); 
    return (
        <div className="flex h-screen w-full bg-background overflow-hidden">
            <Sidebar isOpen={true} />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {children}
            </main>
            <RightSidebar />
        </div>
    );
}
