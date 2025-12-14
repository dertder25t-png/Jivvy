"use client";

import { Tldraw, Editor, TLAssetId } from "tldraw";
import "tldraw/tldraw.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { resizeImage, isImageFile } from "@/utils/imageUtils";
import { uploadCanvasSnapshot } from "@/utils/supabase/storage";
import { uploadImageAction } from "@/app/project/upload-actions";
import { createClient } from "@/utils/supabase/client";

interface InfiniteCanvasProps {
    className?: string;
    blurAmount?: number;
    projectId?: string;
    userId?: string;
}

const AUTO_SAVE_INTERVAL = 5 * 60 * 1000; // 5 minutes in ms
const MAX_IMAGE_SIZE = 2000; // Max pixel dimension

export function InfiniteCanvas({
    className,
    blurAmount = 0,
    projectId = "new",
    userId
}: InfiniteCanvasProps) {
    const editorRef = useRef<Editor | null>(null);
    const lastSaveTimeRef = useRef<number>(Date.now());
    const [isSaving, setIsSaving] = useState(false);

    // Get user ID on mount
    const [currentUserId, setCurrentUserId] = useState<string | null>(userId || null);

    useEffect(() => {
        if (!currentUserId) {
            const supabase = createClient();
            supabase.auth.getUser().then(({ data }) => {
                if (data.user) {
                    setCurrentUserId(data.user.id);
                }
            });
        }
    }, [currentUserId]);

    // Auto-save canvas snapshot every 5 minutes
    const saveSnapshot = useCallback(async () => {
        if (!editorRef.current || !currentUserId || projectId === "new") return;

        try {
            setIsSaving(true);
            // Use TLDraw's public API to get a serializable snapshot
            const snapshot = editorRef.current.store.getStoreSnapshot();
            const jsonString = JSON.stringify(snapshot);
            const blob = new Blob([jsonString], { type: 'application/json' });

            await uploadCanvasSnapshot(blob, currentUserId, projectId);
            lastSaveTimeRef.current = Date.now();
            console.log('Canvas snapshot saved');
        } catch (error) {
            console.error('Failed to save canvas snapshot:', error);
        } finally {
            setIsSaving(false);
        }
    }, [currentUserId, projectId]);

    // Set up auto-save interval
    useEffect(() => {
        const interval = setInterval(() => {
            if (editorRef.current && currentUserId && projectId !== "new") {
                saveSnapshot();
            }
        }, AUTO_SAVE_INTERVAL);

        return () => clearInterval(interval);
    }, [saveSnapshot, currentUserId, projectId]);

    // Handle editor mount
    const handleMount = useCallback((editor: Editor) => {
        editorRef.current = editor;

        // Override the default asset upload handler
        editor.registerExternalAssetHandler('file', async ({ file }) => {
            if (!currentUserId) {
                throw new Error('User not authenticated');
            }

            if (!isImageFile(file)) {
                throw new Error('Only image files are supported');
            }

            // Resize image if needed
            let processedFile: File | Blob = file;
            const img = new Image();
            const url = URL.createObjectURL(file);

            await new Promise<void>((resolve) => {
                img.onload = () => {
                    URL.revokeObjectURL(url);
                    resolve();
                };
                img.src = url;
            });

            if (img.width > MAX_IMAGE_SIZE || img.height > MAX_IMAGE_SIZE) {
                console.log(`Resizing image from ${img.width}x${img.height} to max ${MAX_IMAGE_SIZE}px`);
                processedFile = await resizeImage(file, MAX_IMAGE_SIZE);
            }

            // Upload to Supabase storage via Server Action (Security)
            const uploadFile = processedFile instanceof Blob && !(processedFile instanceof File)
                ? new File([processedFile], file.name, { type: file.type })
                : processedFile as File;

            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('userId', currentUserId);

            const { url: publicUrl, error } = await uploadImageAction(formData);

            if (error || !publicUrl) {
                console.error("Upload failed:", error);
                throw new Error(error || 'Failed to upload image');
            }

            // Return the asset info for TLDraw
            return {
                id: `asset:${Date.now()}` as TLAssetId,
                type: 'image',
                typeName: 'asset',
                props: {
                    name: file.name,
                    src: publicUrl,
                    w: img.width > MAX_IMAGE_SIZE
                        ? (img.width > img.height ? MAX_IMAGE_SIZE : (img.width / img.height) * MAX_IMAGE_SIZE)
                        : img.width,
                    h: img.height > MAX_IMAGE_SIZE
                        ? (img.height > img.width ? MAX_IMAGE_SIZE : (img.height / img.width) * MAX_IMAGE_SIZE)
                        : img.height,
                    mimeType: file.type,
                    isAnimated: false,
                },
                meta: {},
            };
        });
    }, [currentUserId]);

    return (
        <div
            className={cn("w-full h-full relative rounded-2xl overflow-hidden", className)}
            style={{
                filter: blurAmount > 0 ? `blur(${blurAmount / 10}px)` : 'none',
                transition: 'filter 0.3s ease-out'
            }}
        >
            <Tldraw
                persistenceKey={`jivvy-canvas-${projectId}`}
                className="tldraw-editor"
                onMount={handleMount}
            />

            {/* Save indicator */}
            {isSaving && (
                <div className="absolute top-4 right-4 bg-zinc-900/90 text-lime-400 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 z-50">
                    <div className="w-2 h-2 bg-lime-400 rounded-full animate-pulse" />
                    Saving...
                </div>
            )}

            {/* Custom styling overlay for lighter theme */}
            <style jsx global>{`
                .tldraw-editor {
                    --color-background: #3a3a3d !important;
                    --color-panel: #2a2a2d !important;
                    border-radius: 0.75rem;
                }
                
                .tl-container {
                    background-color: #3a3a3d !important;
                }
                
                .tlui-layout {
                    background: transparent !important;
                }
                
                .tlui-menu-zone {
                    background: rgba(42, 42, 45, 0.95) !important;
                    backdrop-filter: blur(16px);
                    border-radius: 0.75rem;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                }
                
                .tlui-toolbar {
                    background: rgba(42, 42, 45, 0.95) !important;
                    backdrop-filter: blur(16px);
                    border-radius: 0.75rem !important;
                    border: 1px solid rgba(255, 255, 255, 0.08) !important;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3) !important;
                }
                
                .tlui-button {
                    color: #a1a1aa !important;
                }
                
                .tlui-button:hover {
                    background: rgba(163, 230, 53, 0.1) !important;
                    color: #a3e635 !important;
                }
                
                .tlui-button[data-state="selected"] {
                    background: rgba(163, 230, 53, 0.2) !important;
                    color: #a3e635 !important;
                }
            `}</style>
        </div>
    );
}
