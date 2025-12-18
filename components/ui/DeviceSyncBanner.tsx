"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, Upload, Check, X } from "lucide-react";
import { GummyButton } from "./GummyButton";
import { hasPDFLocally, saveProjectPDF, getProjectPDF } from "@/lib/db";
import { generateFileHash, formatFileSize } from "@/lib/file-utils";

interface DeviceSyncBannerProps {
    projectId: string;
    expectedFilename?: string;
    expectedHash?: string; // SHA-256 hash from Supabase
    onFileLoaded?: (blob: Blob) => void;
}

/**
 * Banner component that detects when local files are missing
 * and prompts users to re-upload with hash verification
 */
export function DeviceSyncBanner({
    projectId,
    expectedFilename = "document.pdf",
    expectedHash,
    onFileLoaded,
}: DeviceSyncBannerProps) {
    const [isMissing, setIsMissing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [hashMismatch, setHashMismatch] = useState(false);
    const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
    const [isDismissed, setIsDismissed] = useState(false);

    // Check if file exists locally on mount
    useEffect(() => {
        async function checkLocalFile() {
            try {
                const hasFile = await hasPDFLocally(projectId);
                setIsMissing(!hasFile);

                // If file exists, load it for the callback
                if (hasFile && onFileLoaded) {
                    const pdf = await getProjectPDF(projectId);
                    if (pdf) {
                        onFileLoaded(pdf.blob);
                    }
                }
            } catch (error) {
                console.error("Error checking local file:", error);
                setIsMissing(true);
            }
        }

        checkLocalFile();
    }, [projectId, onFileLoaded]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setHashMismatch(false);
        setUploadedFilename(file.name);

        try {
            // Generate hash of uploaded file
            const uploadedHash = await generateFileHash(file);

            // Verify against expected hash if provided
            if (expectedHash && uploadedHash !== expectedHash) {
                setHashMismatch(true);
                setIsUploading(false);
                return;
            }

            // Convert File to Blob and save to IndexedDB
            const blob = new Blob([await file.arrayBuffer()], { type: file.type });
            await saveProjectPDF(projectId, file.name, blob, uploadedHash);

            // Notify parent component
            if (onFileLoaded) {
                onFileLoaded(blob);
            }

            setIsMissing(false);
            setIsUploading(false);
        } catch (error) {
            console.error("Error uploading file:", error);
            setIsUploading(false);
        }
    };

    const handleOverrideUpload = async () => {
        // User chose to upload different file anyway
        const input = document.getElementById(`file-upload-${projectId}`) as HTMLInputElement;
        const file = input?.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const uploadedHash = await generateFileHash(file);
            const blob = new Blob([await file.arrayBuffer()], { type: file.type });
            await saveProjectPDF(projectId, file.name, blob, uploadedHash);

            if (onFileLoaded) {
                onFileLoaded(blob);
            }

            setIsMissing(false);
            setHashMismatch(false);
            setIsUploading(false);
        } catch (error) {
            console.error("Error overriding file:", error);
            setIsUploading(false);
        }
    };

    // Don't show if file exists or dismissed
    if (!isMissing || isDismissed) {
        return null;
    }

    return (
        <div className="relative bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-2 border-amber-500/50 rounded-xl p-4 mb-4">
            {/* Dismiss button */}
            <button
                onClick={() => setIsDismissed(true)}
                className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-white transition-colors"
                title="Dismiss"
            >
                <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 p-2 bg-amber-500/20 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>

                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white mb-1">
                        Continue from where you left off
                    </h4>
                    <p className="text-sm text-zinc-400 mb-3">
                        Upload <span className="text-amber-400 font-medium">{expectedFilename}</span> from this device to continue working.
                    </p>

                    {/* Hash mismatch warning */}
                    {hashMismatch && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
                            <p className="text-sm text-red-400">
                                <strong>Warning:</strong> This file appears different from the original version.
                                Using a different file may cause data inconsistencies.
                            </p>
                            <div className="flex gap-2 mt-2">
                                <GummyButton
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleOverrideUpload}
                                    className="text-red-400 border-red-500/30"
                                >
                                    Upload Anyway
                                </GummyButton>
                                <GummyButton
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setHashMismatch(false)}
                                    className="text-zinc-400"
                                >
                                    Cancel
                                </GummyButton>
                            </div>
                        </div>
                    )}

                    {/* Upload input */}
                    {!hashMismatch && (
                        <label className="relative inline-flex cursor-pointer">
                            <input
                                id={`file-upload-${projectId}`}
                                type="file"
                                accept=".pdf,application/pdf"
                                onChange={handleFileUpload}
                                className="sr-only"
                                disabled={isUploading}
                            />
                            <GummyButton
                                size="sm"
                                disabled={isUploading}
                                className="flex items-center gap-2"
                            >
                                {isUploading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-lime-400 border-t-transparent rounded-full animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Select File
                                    </>
                                )}
                            </GummyButton>
                        </label>
                    )}
                </div>
            </div>
        </div>
    );
}
