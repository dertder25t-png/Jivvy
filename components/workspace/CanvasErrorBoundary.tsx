
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
    console.error("Canvas Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-zinc-950 p-6">
          <div className="text-center max-w-md space-y-4">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
               <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h2 className="text-xl font-bold text-white">Canvas crashed</h2>
            <p className="text-zinc-400 text-sm">
              Something went wrong with the infinite canvas. This might be due to a WebGL context loss or a rendering error.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full font-medium transition-colors flex items-center gap-2 mx-auto"
            >
              <RefreshCw size={16} /> Reload Canvas
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
