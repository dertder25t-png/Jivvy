"use client";

import React, { useEffect, useRef, useState } from "react";
import { useFabric } from "./useFabric";
import { Toolbar, CanvasMode } from "./Toolbar";
import { LayersPanel } from "./LayersPanel";

export default function JivvyCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  // Correctly use the hook once
  const { canvasRef, fabricCanvas } = useFabric(containerRef);

  const [mode, setMode] = useState<CanvasMode>("professional");
  const [showLayers, setShowLayers] = useState(true);

  // History Management
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (!fabricCanvas) return;

    // Initial State
    const saveState = () => {
        if(isLocked) return;
        const json = JSON.stringify(fabricCanvas.toJSON());
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(json);
            return newHistory;
        });
        setHistoryIndex(prev => prev + 1);
    };

    // Save initial state
    const timer = setTimeout(() => {
       if (history.length === 0) saveState();
    }, 100);

    const handleObjectModified = () => {
        saveState();
    };

    const handleObjectAdded = (e: any) => {
         // Prevent saving history on loading from history or if flagged
         if(!e.target?.excludeFromExport) saveState();
    };

    fabricCanvas.on("object:modified", handleObjectModified);
    fabricCanvas.on("object:added", handleObjectAdded);
    fabricCanvas.on("object:removed", handleObjectModified); // Remove is also a mod

    return () => {
        clearTimeout(timer);
        fabricCanvas.off("object:modified", handleObjectModified);
        fabricCanvas.off("object:added", handleObjectAdded);
        fabricCanvas.off("object:removed", handleObjectModified);
    };
  }, [fabricCanvas, history, historyIndex, isLocked]);

  // Separate useEffect for Undo/Redo listeners
  useEffect(() => {
    if (!fabricCanvas) return;

    const undoHandler = () => {
        if (historyIndex > 0) {
            setIsLocked(true);
            const prevIndex = historyIndex - 1;
            const json = history[prevIndex];
            fabricCanvas.loadFromJSON(JSON.parse(json)).then(() => {
                 fabricCanvas.renderAll();
                 setHistoryIndex(prevIndex);
                 setIsLocked(false);
            });
        }
    };

    const redoHandler = () => {
        if (historyIndex < history.length - 1) {
            setIsLocked(true);
            const nextIndex = historyIndex + 1;
            const json = history[nextIndex];
            fabricCanvas.loadFromJSON(JSON.parse(json)).then(() => {
                fabricCanvas.renderAll();
                setHistoryIndex(nextIndex);
                setIsLocked(false);
            });
        }
    };

    document.addEventListener('undo', undoHandler);
    document.addEventListener('redo', redoHandler);

    return () => {
        document.removeEventListener('undo', undoHandler);
        document.removeEventListener('redo', redoHandler);
    };
  }, [fabricCanvas, history, historyIndex]);

  return (
    <div className="relative w-full h-full bg-zinc-950 overflow-hidden text-white" ref={containerRef}>
      <Toolbar
        canvas={fabricCanvas}
        mode={mode}
        setMode={setMode}
        showLayers={showLayers}
        setShowLayers={setShowLayers}
      />

      {/* Use the ref from the hook */}
      <canvas ref={canvasRef} />

      {/* Layers Panel - Right Side */}
      {showLayers && (mode === "professional") && (
        <div className="absolute top-20 right-4 bottom-4 z-40 pointer-events-none">
           <div className="pointer-events-auto h-full">
              <LayersPanel canvas={fabricCanvas} />
           </div>
        </div>
      )}
    </div>
  );
}
