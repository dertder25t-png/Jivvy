'use client';

import React, { useRef } from 'react';
import { Block } from '@/lib/db';
import { cn } from '@/lib/utils';
import { ImageIcon, Upload, X } from 'lucide-react';

interface ImageBlockProps {
    block: Block;
    onUpdate: (id: string, updates: Partial<Block>) => void;
    onKeyDown: (e: React.KeyboardEvent, block: Block) => void;
    autoFocus?: boolean;
    onDelete?: () => void;
}

export const ImageBlock: React.FC<ImageBlockProps> = ({ block, onUpdate, onKeyDown, autoFocus, onDelete }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const hasImage = block.content && block.content.startsWith('data:image');

    const handleClick = () => {
        if (!hasImage) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            console.error('Invalid file type. Please select an image.');
            return;
        }

        // Convert to Base64
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64String = event.target?.result as string;
            onUpdate(block.id, { content: base64String });
        };
        reader.onerror = () => {
            console.error('Failed to read file');
        };
        reader.readAsDataURL(file);

        // Reset input so same file can be selected again
        e.target.value = '';
    };

    const handleRemoveImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdate(block.id, { content: '' });
    };

    const handleKeyDownCapture = (e: React.KeyboardEvent) => {
        // Handle delete on backspace when image is empty
        if (e.key === 'Backspace' && !hasImage) {
            e.preventDefault();
            onDelete?.();
        }
        onKeyDown(e, block);
    };

    return (
        <div
            className="group py-2 relative"
            tabIndex={0}
            onKeyDown={handleKeyDownCapture}
        >
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />

            {hasImage ? (
                /* Image Display State */
                <div className="relative rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
                    <img
                        src={block.content}
                        alt="Uploaded image"
                        className="w-full h-auto max-h-[400px] object-contain"
                    />
                    {/* Remove button - visible on hover */}
                    <button
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all"
                    >
                        <X size={14} />
                    </button>
                </div>
            ) : (
                /* Empty Upload Placeholder State */
                <button
                    onClick={handleClick}
                    className={cn(
                        "w-full flex flex-col items-center justify-center gap-2 py-8 px-4",
                        "border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg",
                        "bg-zinc-50 dark:bg-zinc-900/50",
                        "hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20",
                        "transition-colors cursor-pointer group/upload"
                    )}
                >
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-700 group-hover/upload:bg-blue-100 dark:group-hover/upload:bg-blue-900/30 transition-colors">
                        <Upload size={20} className="text-zinc-400 group-hover/upload:text-blue-500 transition-colors" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 group-hover/upload:text-blue-600 dark:group-hover/upload:text-blue-400 transition-colors">
                            Click to upload image
                        </p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                            PNG, JPG, GIF up to 10MB
                        </p>
                    </div>
                </button>
            )}
        </div>
    );
};
