import React from 'react';
import { Block, db } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { FileText, Trash2, ArrowRight } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/lib/utils';

interface SubpageBlockProps {
    block: Block;
    onDelete?: () => void;
    autoFocus?: boolean;
}

export const SubpageBlock: React.FC<SubpageBlockProps> = ({ block, onDelete }) => {
    const router = useRouter();
    const projectId = block.metadata?.child_project_id;

    const project = useLiveQuery(async () => {
        if (!projectId) return null;
        return db.projects.get(projectId);
    }, [projectId]);

    const handleNavigate = () => {
        if (projectId) {
            router.push(`/project/${projectId}`);
        }
    };

    if (!projectId) {
        return (
            <div className="p-3 border border-red-200 bg-red-50 text-red-500 rounded flex items-center gap-2">
                <span>Invalid Subpage Link</span>
                <button onClick={onDelete} className="ml-auto p-1 hover:bg-red-100 rounded">
                    <Trash2 size={14} />
                </button>
            </div>
        );
    }

    return (
        <div
            className="group flex items-center gap-3 p-3 my-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer"
            onClick={handleNavigate}
        >
            <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <FileText size={16} />
            </div>

            <div className="flex-1">
                <h3 className="text-sm font-medium text-text-primary">
                    {project ? project.title : 'Loading...'}
                </h3>
                <p className="text-[11px] text-zinc-500">
                    Subpage
                </p>
            </div>

            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.();
                    }}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                    title="Delete link"
                >
                    <Trash2 size={14} />
                </button>
                <button
                    className="p-1.5 text-zinc-400 group-hover:text-blue-500"
                >
                    <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
};
