"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { FabricObject } from "fabric";
import { useFabric } from "./useFabric";
import { Toolbar, CanvasMode } from "./Toolbar";
import { LayersPanel } from "./LayersPanel";

// Custom ID counter for objects
let objectIdCounter = 0;

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

  // Debounce utility for saveState
  const saveStateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const debouncedSaveState = useCallback(() => {
    if (saveStateTimeoutRef.current) {
      clearTimeout(saveStateTimeoutRef.current);
    }
    saveStateTimeoutRef.current = setTimeout(() => {
      if (!fabricCanvas || isLocked) return;
      const json = JSON.stringify(fabricCanvas.toJSON());
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(json);
        return newHistory;
      });
      setHistoryIndex(prev => prev + 1);
    }, 300); // 300ms debounce
  }, [fabricCanvas, historyIndex, isLocked]);

  useEffect(() => {
    if (!fabricCanvas) return;

    // Save initial state once after mount
    const timer = setTimeout(() => {
      if (history.length === 0) debouncedSaveState();
    }, 100);

    const handleObjectModified = () => {
      debouncedSaveState();
    };

    const handleObjectAdded = (e: { target?: { excludeFromExport?: boolean } }) => {
      // Prevent saving history on loading from history or if flagged
      if (!e.target?.excludeFromExport) debouncedSaveState();
    };

    fabricCanvas.on("object:modified", handleObjectModified);
    fabricCanvas.on("object:added", handleObjectAdded);
    fabricCanvas.on("object:removed", handleObjectModified);

    return () => {
      clearTimeout(timer);
      if (saveStateTimeoutRef.current) {
        clearTimeout(saveStateTimeoutRef.current);
      }
      fabricCanvas.off("object:modified", handleObjectModified);
      fabricCanvas.off("object:added", handleObjectAdded);
      fabricCanvas.off("object:removed", handleObjectModified);
    };
  }, [fabricCanvas, history.length, debouncedSaveState]);

  // Undo/Redo handlers
  const handleUndo = useCallback(() => {
    if (!fabricCanvas || historyIndex <= 0) return;

    setIsLocked(true);
    const prevIndex = historyIndex - 1;
    const json = history[prevIndex];
    fabricCanvas.loadFromJSON(JSON.parse(json)).then(() => {
      fabricCanvas.renderAll();
      setHistoryIndex(prevIndex);
      setIsLocked(false);
    });
  }, [fabricCanvas, history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (!fabricCanvas || historyIndex >= history.length - 1) return;

    setIsLocked(true);
    const nextIndex = historyIndex + 1;
    const json = history[nextIndex];
    fabricCanvas.loadFromJSON(JSON.parse(json)).then(() => {
      fabricCanvas.renderAll();
      setHistoryIndex(nextIndex);
      setIsLocked(false);
    });
  }, [fabricCanvas, history, historyIndex]);

  // Assign custom IDs to new objects
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleObjectAdded = (e: { target: FabricObject }) => {
      const obj = e.target as { customId?: number };
      if (!obj.customId) {
        obj.customId = ++objectIdCounter;
      }
    };

    fabricCanvas.on("object:added", handleObjectAdded);

    return () => {
      fabricCanvas.off("object:added", handleObjectAdded);
    };
  }, [fabricCanvas]);

  return (
    <div className="relative w-full h-full bg-zinc-950 overflow-hidden text-white" ref={containerRef}>
      <Toolbar
        canvas={fabricCanvas}
        mode={mode}
        setMode={setMode}
        showLayers={showLayers}
        setShowLayers={setShowLayers}
        onUndo={handleUndo}
        onRedo={handleRedo}
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
