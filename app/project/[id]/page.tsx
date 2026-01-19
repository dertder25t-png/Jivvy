'use client';

import dynamic from 'next/dynamic';
const BlockList = dynamic(() => import('@/components/editor/BlockList').then(mod => mod.BlockList), { ssr: false });
import { ProjectHeader } from '@/components/editor/ProjectHeader';
import { useParams } from 'next/navigation';

import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

export default function ProjectPage() {
    const params = useParams();
    const id = params.id as string;

    // Fetch project to get color
    const project = useLiveQuery(() => db.projects.get(id), [id]);

    return (
        <div className="h-full flex flex-col bg-surface-100 dark:bg-zinc-950 overflow-y-auto">
            <ProjectHeader projectId={id} />
            <BlockList projectId={id} projectColor={project?.color} />
        </div>
    );
}
