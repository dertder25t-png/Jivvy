"use client";

import React, { useState, useEffect } from "react";
import { Canvas, FabricImage, Rect, Circle, Triangle, Textbox, PencilBrush } from "fabric";
import { GummyButton } from "@/components/ui/GummyButton";
import { TiltCard } from "@/components/ui/TiltCard"; // Might not need this if we go for a pure glass bar
import {
  Type,
  Square,
  Circle as CircleIcon,
  Triangle as TriangleIcon,
  Pencil,
  Image as ImageIcon,
  Undo,
  Redo,
  Download,
  Layers,
  Settings,
  MousePointer2,
  Trash2,
  Palette
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CanvasMode = "typography" | "illustration" | "photo" | "professional";

interface ToolbarProps {
  canvas: Canvas | null;
  mode: CanvasMode;
  setMode: (mode: CanvasMode) => void;
  showLayers: boolean;
  setShowLayers: (show: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function Toolbar({ canvas, mode, setMode, showLayers, setShowLayers, onUndo, onRedo }: ToolbarProps) {
  const [selectedColor, setSelectedColor] = useState("#a3e635"); // lime-400
  const [brushWidth, setBrushWidth] = useState(5);
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTool, setActiveTool] = useState<string>("select");

  // Initialize and update pencil brush when canvas or settings change
  useEffect(() => {
    if (!canvas) return;

    // Initialize PencilBrush if not already set
    if (!canvas.freeDrawingBrush || !(canvas.freeDrawingBrush instanceof PencilBrush)) {
      canvas.freeDrawingBrush = new PencilBrush(canvas);
    }

    // Update brush settings
    canvas.freeDrawingBrush.color = selectedColor;
    canvas.freeDrawingBrush.width = brushWidth;
  }, [canvas, selectedColor, brushWidth]);

  // Sync drawing mode state
  useEffect(() => {
    if (!canvas) return;
    setIsDrawing(canvas.isDrawingMode);
    if (canvas.isDrawingMode) setActiveTool("draw");
    else if (activeTool === "draw") setActiveTool("select");
  }, [canvas?.isDrawingMode]);

  // Handle mode switching with side effects
  const handleModeChange = (newMode: CanvasMode) => {
    setMode(newMode);
    // Reset tools when switching modes if needed
    if (canvas) {
      canvas.isDrawingMode = false;
      setIsDrawing(false);
      setActiveTool("select");
    }
  };

  // Typography Tools
  const addText = () => {
    if (!canvas) return;
    const text = new Textbox("Double-click to edit", {
      left: 100,
      top: 100,
      fontSize,
      fontFamily,
      fill: selectedColor,
      editable: true,
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    setActiveTool("text");
  };

  // Illustration Tools
  const addShape = (shapeType: 'rect' | 'circle' | 'triangle') => {
    if (!canvas) return;
    let shape;
    const common = {
      left: 100,
      top: 100,
      fill: selectedColor,
      stroke: "#ffffff",
      strokeWidth: 2,
    };

    if (shapeType === 'rect') {
      shape = new Rect({ ...common, width: 150, height: 100 });
    } else if (shapeType === 'circle') {
      shape = new Circle({ ...common, radius: 50 });
    } else {
      shape = new Triangle({ ...common, width: 100, height: 100 });
    }

    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.renderAll();
    setActiveTool(shapeType);
  };

  const toggleDrawing = () => {
    if (!canvas) return;
    canvas.isDrawingMode = !canvas.isDrawingMode;
    setIsDrawing(canvas.isDrawingMode);
    setActiveTool(canvas.isDrawingMode ? "draw" : "select");
    canvas.renderAll();
  };

  // Photo Tools
  const uploadImage = () => {
    if (!canvas) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const imgUrl = event.target?.result as string;
        FabricImage.fromURL(imgUrl).then((img) => {
          img.scale(0.5);
          img.set({ left: 100, top: 100 });
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          setActiveTool("image");
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // Export
  const exportCanvas = (format: "png" | "jpg" | "svg") => {
    if (!canvas) return;

    let dataUrl: string;
    if (format === "svg") {
      dataUrl = canvas.toSVG();
      const blob = new Blob([dataUrl], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `jivvy-design.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      dataUrl = canvas.toDataURL({
        format: format === "png" ? "png" : "jpeg",
        quality: 1,
        multiplier: 1,
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `jivvy-design.${format}`;
      link.click();
    }
  };

  // Delete selected object
  const deleteSelected = () => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach((obj) => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4 w-full max-w-4xl px-4 pointer-events-none">

      {/* 1. Main Floating Dock (Mode Switcher + Core Tools) */}
      <div className="pointer-events-auto bg-zinc-950/80 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-4 duration-500">

        {/* Mode Switcher */}
        <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-xl mr-2 border border-white/5">
          {[
            { id: "typography", icon: Type, label: "Text" },
            { id: "illustration", icon: Pencil, label: "Draw" },
            { id: "photo", icon: ImageIcon, label: "Media" },
            { id: "professional", icon: Settings, label: "Pro" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id as CanvasMode)}
              className={cn(
                "p-2 rounded-lg transition-all text-zinc-400 hover:text-white hover:bg-white/10",
                mode === m.id && "bg-zinc-800 text-lime-400 shadow-sm ring-1 ring-white/10"
              )}
              title={m.label}
            >
              <m.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Dynamic Tools Based on Mode */}
        <div className="flex items-center gap-1">

          {/* Common / Select Tool */}
          <button
            onClick={() => {
              if (canvas) {
                canvas.isDrawingMode = false;
                setIsDrawing(false);
                setActiveTool("select");
              }
            }}
            className={cn(
              "p-2 rounded-lg transition-all",
              activeTool === "select" ? "bg-lime-400/20 text-lime-400" : "text-zinc-400 hover:text-white hover:bg-white/10"
            )}
            title="Select"
          >
            <MousePointer2 className="w-4 h-4" />
          </button>

          {/* Typography Tools */}
          {(mode === "typography" || mode === "professional") && (
            <>
              <button onClick={addText} className={cn("p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10", activeTool === 'text' && "bg-white/10 text-white")}>
                <Type className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 bg-zinc-900/50 rounded-lg px-2 py-1 border border-white/5 mx-1">
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="bg-transparent text-xs text-zinc-300 focus:outline-none w-20 cursor-pointer"
                >
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times</option>
                  <option value="Courier New">Courier</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Verdana">Verdana</option>
                </select>
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  min="8"
                  max="200"
                  className="bg-transparent text-xs text-zinc-300 w-10 text-center border-l border-white/10 focus:outline-none"
                />
              </div>
            </>
          )}

          {/* Illustration Tools */}
          {(mode === "illustration" || mode === "professional") && (
            <>
              <div className="flex gap-1 mx-1">
                <button onClick={() => addShape('rect')} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10">
                  <Square className="w-4 h-4" />
                </button>
                <button onClick={() => addShape('circle')} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10">
                  <CircleIcon className="w-4 h-4" />
                </button>
                <button onClick={() => addShape('triangle')} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10">
                  <TriangleIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="w-px h-6 bg-white/10 mx-1" />

              <div className="flex items-center gap-1">
                <button
                  onClick={toggleDrawing}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    isDrawing ? "bg-lime-400/20 text-lime-400" : "text-zinc-400 hover:text-white hover:bg-white/10"
                  )}
                >
                  <Pencil className="w-4 h-4" />
                </button>

                {isDrawing && (
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={brushWidth}
                    onChange={(e) => setBrushWidth(Number(e.target.value))}
                    className="w-20 accent-lime-400 h-1 bg-zinc-700 rounded-full appearance-none ml-2"
                  />
                )}
              </div>
            </>
          )}

          {/* Photo Tools */}
          {(mode === "photo" || mode === "professional") && (
            <button onClick={uploadImage} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10">
              <ImageIcon className="w-4 h-4" />
            </button>
          )}

          <div className="w-px h-8 bg-white/10 mx-1" />

          {/* Universal Color Picker */}
          <div className="relative group mx-1">
            <div
              className="w-6 h-6 rounded-lg cursor-pointer border-2 border-white/20 hover:scale-110 transition-transform"
              style={{ backgroundColor: selectedColor }}
            />
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>

        </div>

        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Actions */}
        <div className="flex gap-1">
          <button onClick={onUndo} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10">
            <Undo className="w-4 h-4" />
          </button>
          <button onClick={onRedo} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10">
            <Redo className="w-4 h-4" />
          </button>
          <button onClick={deleteSelected} className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-400/10">
            <Trash2 className="w-4 h-4" />
          </button>

          <button onClick={() => exportCanvas("png")} className="p-2 rounded-lg text-zinc-400 hover:text-lime-400 hover:bg-lime-400/10 ml-1">
            <Download className="w-4 h-4" />
          </button>

          {mode === "professional" && (
            <button
              onClick={() => setShowLayers(!showLayers)}
              className={cn(
                "p-2 rounded-lg transition-all ml-1",
                showLayers ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white hover:bg-white/10"
              )}
            >
              <Layers className="w-4 h-4" />
            </button>
          )}

        </div>

      </div>

    </div>
  );
}
