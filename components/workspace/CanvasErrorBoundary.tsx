"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class CanvasErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Canvas Error Boundary caught an error:", error, errorInfo);
    }

    private handleReset = () => {
        // Clear all localStorage to remove potentially corrupted canvas state
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (e) {
            console.error("Failed to clear storage", e);
        }
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-400 p-6 text-center">
                    <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 text-red-500">
                        <AlertTriangle size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Canvas Encountered an Error</h2>
                    <p className="text-sm max-w-md mb-6 text-zinc-500">
                        {this.state.error?.message.includes("exceeds max size")
                            ? "The canvas drawing became too large for the browser to render."
                            : "Something went wrong while loading the canvas."}
                    </p>

                    <button
                        onClick={this.handleReset}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-zinc-200 rounded-lg transition-colors font-medium text-sm"
                    >
                        <RefreshCw size={16} />
                        Reload Canvas
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
