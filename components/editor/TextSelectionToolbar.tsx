'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bold } from 'lucide-react';

interface TextSelectionToolbarProps {
    onMakeMainPoint: () => void;
}

export const TextSelectionToolbar: React.FC<TextSelectionToolbarProps> = ({ onMakeMainPoint }) => {
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const [visible, setVisible] = useState(false);
    const toolbarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = window.getSelection();
            
            if (!selection || selection.isCollapsed || selection.toString().trim() === '') {
                setVisible(false);
                return;
            }

            // Verify selection is within the editor (optional check, but good for safety)
            // For now, simpler to just show it if text is selected.
            
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            if (rect.width === 0 && rect.height === 0) {
                 setVisible(false);
                 return;
            }
            
            setPosition({
                top: rect.top - 40 + window.scrollY, // Position above default
                left: rect.left + (rect.width / 2) + window.scrollX
            });
            setVisible(true);
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, []);

    if (!visible || !position) return null;

    // Use Portal to avoid z-index issues / clipping
    return createPortal(
        <div 
            ref={toolbarRef}
            className="fixed z-50 flex items-center gap-1 p-1 bg-zinc-900 text-white rounded shadow-lg -translate-x-1/2 transition-opacity duration-200 animate-in fade-in"
            style={{ top: position.top, left: position.left }}
            onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
        >
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onMakeMainPoint();
                    setVisible(false); // Hide after click
                }}
                className="flex items-center gap-2 px-2 py-1 text-xs font-medium hover:bg-zinc-700 rounded transition-colors"
                title="Convert selection to Main Point"
            >
                <Bold size={14} />
                <span>Make Main Point</span>
            </button>
        </div>,
        document.body
    );
};
