'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bold } from 'lucide-react';

interface TextSelectionToolbarProps {
    onMakeMainPoint: () => void;
    onOpenFlashcardManual: (text: string) => void;
}

export const TextSelectionToolbar: React.FC<TextSelectionToolbarProps> = ({ onMakeMainPoint, onOpenFlashcardManual }) => {
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const [visible, setVisible] = useState(false);
    const toolbarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleMouseUp = (e: MouseEvent) => {
            // Short timeout to let selection settle
            setTimeout(() => {
                const selection = window.getSelection();
                const activeElement = document.activeElement as HTMLElement;
                let text = '';
                let rect: DOMRect | null = null;

                // Handle Textarea/Input selection specifically
                if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
                    const input = activeElement as HTMLTextAreaElement | HTMLInputElement;
                    const start = input.selectionStart;
                    const end = input.selectionEnd;
                    if (start !== null && end !== null && start !== end) {
                        text = input.value.substring(start, end);
                        // Use mouse coordinates for generic positioning since getting accurate caret pos in textarea is hard
                        // We will position it above the mouse cursor
                    }
                } else if (selection && !selection.isCollapsed) {
                    text = selection.toString();
                    if (selection.rangeCount > 0) {
                        rect = selection.getRangeAt(0).getBoundingClientRect();
                    }
                }

                if (!text || text.trim() === '') {
                    setVisible(false);
                    return;
                }

                // Calculate position
                if (rect) {
                    // Standard contentEditable support
                    setPosition({
                        top: rect.top - 40 + window.scrollY,
                        left: rect.left + (rect.width / 2) + window.scrollX
                    });
                } else {
                    // Mouse fallback (for textarea)
                    setPosition({
                        top: e.clientY - 40 + window.scrollY,
                        left: e.clientX + window.scrollX
                    });
                }
                setVisible(true);
            }, 10);
        };

        const handleSelectionChange = () => {
            // We still listen to clear it if selection becomes empty via keyboard
            const selection = window.getSelection();
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
                const input = activeElement as HTMLInputElement;
                if (input.selectionStart === input.selectionEnd) setVisible(false);
            } else {
                if (!selection || selection.isCollapsed) setVisible(false);
            }
        };

        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('selectionchange', handleSelectionChange);

        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
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
                <span>Main Point</span>
            </button>
            <div className="w-px h-4 bg-zinc-700 mx-1" />
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    const selection = window.getSelection();
                    const text = selection?.toString() || '';
                    if (text) {
                        onOpenFlashcardManual(text);
                    }
                    setVisible(false);
                }}
                className="flex items-center gap-2 px-2 py-1 text-xs font-medium hover:bg-zinc-700 rounded transition-colors"
                title="Create Flashcard from selection"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-zap"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                <span>Flashcard (Beta)</span>
            </button>
        </div>,
        document.body
    );
};
