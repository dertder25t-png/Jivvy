"use client";

import React, { useState } from "react";
import { Canvas, FabricImage, Rect, Circle, Triangle, Textbox } from "fabric";
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
} from "lucide-react";

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
  };

  // Illustration Tools
  const addRect = () => {
    if (!canvas) return;
    const rect = new Rect({
      left: 100,
      top: 100,
      width: 150,
      height: 100,
      fill: selectedColor,
      stroke: "#ffffff",
      strokeWidth: 2,
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
  };

  const addCircle = () => {
    if (!canvas) return;
    const circle = new Circle({
      left: 100,
      top: 100,
      radius: 50,
      fill: selectedColor,
      stroke: "#ffffff",
      strokeWidth: 2,
    });
    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.renderAll();
  };

  const addTriangle = () => {
    if (!canvas) return;
    const triangle = new Triangle({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      fill: selectedColor,
      stroke: "#ffffff",
      strokeWidth: 2,
    });
    canvas.add(triangle);
    canvas.setActiveObject(triangle);
    canvas.renderAll();
  };

  const enableDrawing = () => {
    if (!canvas) return;
    canvas.isDrawingMode = !canvas.isDrawingMode;
    if (canvas.isDrawingMode && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = selectedColor;
      canvas.freeDrawingBrush.width = brushWidth;
    }
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
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // History Management (now using callbacks from props)
  // onUndo and onRedo are passed from parent component

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
    <div className="absolute top-4 left-4 right-4 z-50 flex items-start justify-between gap-4">
      {/* Mode Selector */}
      <div className="bg-zinc-900 border-2 border-zinc-700 rounded-2xl p-2 flex gap-2">
        <button
          onClick={() => setMode("typography")}
          title="Typography Mode"
          className={`h-9 w-9 flex items-center justify-center rounded-xl transition-colors ${mode === "typography" ? "bg-lime-400 text-black" : "text-zinc-400 hover:text-white"}`}
        >
          <Type className="w-4 h-4" />
        </button>
        <button
          onClick={() => setMode("illustration")}
          title="Illustration Mode"
          className={`h-9 w-9 flex items-center justify-center rounded-xl transition-colors ${mode === "illustration" ? "bg-lime-400 text-black" : "text-zinc-400 hover:text-white"}`}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => setMode("photo")}
          title="Photo Mode"
          className={`h-9 w-9 flex items-center justify-center rounded-xl transition-colors ${mode === "photo" ? "bg-lime-400 text-black" : "text-zinc-400 hover:text-white"}`}
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => setMode("professional")}
          title="Professional Mode"
          className={`h-9 w-9 flex items-center justify-center rounded-xl transition-colors ${mode === "professional" ? "bg-lime-400 text-black" : "text-zinc-400 hover:text-white"}`}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Tools Panel */}
      <div className="bg-zinc-900 border-2 border-zinc-700 rounded-2xl p-2 flex gap-2 flex-wrap max-w-2xl">
        {/* Typography Mode Tools */}
        {(mode === "typography" || mode === "professional") && (
          <>
            <button
              onClick={addText}
              title="Add Text"
              className="h-9 w-9 flex items-center justify-center rounded-xl border-2 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
            >
              <Type className="w-4 h-4" />
            </button>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="h-9 px-3 text-sm bg-zinc-800 border-2 border-zinc-700 text-zinc-300 rounded-xl focus:outline-none focus:border-lime-400"
            >
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="Georgia">Georgia</option>
              <option value="Verdana">Verdana</option>
            </select>
            <input
              type="number"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              min="8"
              max="200"
              className="w-20 h-9 px-3 text-sm bg-zinc-800 border-2 border-zinc-700 text-zinc-300 rounded-xl focus:outline-none focus:border-lime-400"
              placeholder="Size"
            />
          </>
        )}

        {/* Illustration Mode Tools */}
        {(mode === "illustration" || mode === "professional") && (
          <>
            <button
              onClick={addRect}
              title="Add Rectangle"
              className="h-9 w-9 flex items-center justify-center rounded-xl border-2 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              onClick={addCircle}
              title="Add Circle"
              className="h-9 w-9 flex items-center justify-center rounded-xl border-2 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
            >
              <CircleIcon className="w-4 h-4" />
            </button>
            <button
              onClick={addTriangle}
              title="Add Triangle"
              className="h-9 w-9 flex items-center justify-center rounded-xl border-2 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
            >
              <TriangleIcon className="w-4 h-4" />
            </button>
            <button
              onClick={enableDrawing}
              title="Free Drawing"
              className={`h-9 w-9 flex items-center justify-center rounded-xl border-2 transition-colors ${canvas?.isDrawingMode ? "bg-lime-400 border-lime-400 text-black" : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"}`}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <input
              type="number"
              value={brushWidth}
              onChange={(e) => setBrushWidth(Number(e.target.value))}
              min="1"
              max="50"
              className="w-20 h-9 px-3 text-sm bg-zinc-800 border-2 border-zinc-700 text-zinc-300 rounded-xl focus:outline-none focus:border-lime-400"
              placeholder="Brush"
            />
          </>
        )}

        {/* Photo Mode Tools */}
        {(mode === "photo" || mode === "professional") && (
          <>
            <button
              onClick={uploadImage}
              title="Upload Image"
              className="h-9 w-9 flex items-center justify-center rounded-xl border-2 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Universal Tools */}
        <input
          type="color"
          value={selectedColor}
          onChange={(e) => setSelectedColor(e.target.value)}
          className="w-9 h-9 bg-zinc-800 border-2 border-zinc-700 rounded-xl cursor-pointer"
          title="Color"
        />
      </div>

      {/* Actions Panel */}
      <div className="bg-zinc-900 border-2 border-zinc-700 rounded-2xl p-2 flex gap-2">
        <button
          onClick={onUndo}
          title="Undo"
          className="h-9 w-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          title="Redo"
          className="h-9 w-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <Redo className="w-4 h-4" />
        </button>
        <button
          onClick={deleteSelected}
          title="Delete"
          className="h-9 w-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
        >
          <span className="text-sm">🗑️</span>
        </button>
        <button
          onClick={() => exportCanvas("png")}
          title="Export PNG"
          className="h-9 w-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <Download className="w-4 h-4" />
        </button>
        {mode === "professional" && (
          <button
            onClick={() => setShowLayers(!showLayers)}
            title="Toggle Layers"
            className={`h-9 w-9 flex items-center justify-center rounded-xl transition-colors ${showLayers ? "bg-lime-400 text-black" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
          >
            <Layers className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
