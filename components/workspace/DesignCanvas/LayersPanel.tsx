"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Canvas, FabricObject } from "fabric";
import { Eye, EyeOff, Lock, Unlock, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

// Throttle utility for performance
function throttle(fn: () => void, limit: number): () => void {
  let inThrottle = false;
  let pending = false;

  return () => {
    if (!inThrottle) {
      fn();
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (pending) {
          fn();
          pending = false;
        }
      }, limit);
    } else {
      pending = true;
    }
  };
}

// Extended Fabric object type with custom properties
interface CustomFabricObject extends FabricObject {
  customId?: number;
  name?: string;
}

interface LayerItem {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
  object: CustomFabricObject;
}

interface LayersPanelProps {
  canvas: Canvas | null;
}

export function LayersPanel({ canvas }: LayersPanelProps) {
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Memoized layer update function
  const updateLayersFromCanvas = useCallback(() => {
    if (!canvas) return;

    const objects = canvas.getObjects() as CustomFabricObject[];
    const layerItems: LayerItem[] = objects.map((obj, index) => {
      const type = obj.type || "object";
      const name = obj.name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${index + 1}`;

      return {
        id: obj.customId?.toString() || `${index}`,
        name,
        type,
        visible: obj.visible !== false,
        locked: obj.selectable === false,
        object: obj,
      };
    }).reverse(); // Reverse to show top layer first

    setLayers(layerItems);
  }, [canvas]);

  useEffect(() => {
    if (!canvas) return;

    // Throttled update handler (100ms)
    const throttledUpdate = throttle(() => {
      updateLayersFromCanvas();
    }, 100);

    // Initial update
    updateLayersFromCanvas();

    // Listen to canvas events
    canvas.on("object:added", throttledUpdate);
    canvas.on("object:removed", throttledUpdate);
    canvas.on("object:modified", throttledUpdate);

    return () => {
      canvas.off("object:added", throttledUpdate);
      canvas.off("object:removed", throttledUpdate);
      canvas.off("object:modified", throttledUpdate);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [canvas, updateLayersFromCanvas]);

  const selectLayer = (layer: LayerItem) => {
    if (!canvas) return;
    canvas.setActiveObject(layer.object);
    canvas.renderAll();
    setSelectedLayerId(layer.id);
  };

  const toggleVisibility = (layer: LayerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvas) return;

    layer.object.visible = !layer.object.visible;
    canvas.renderAll();
    canvas.fire("object:modified", { target: layer.object });
  };

  const toggleLock = (layer: LayerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvas) return;

    layer.object.selectable = !layer.object.selectable;
    layer.object.evented = !layer.object.evented;
    canvas.renderAll();
    canvas.fire("object:modified", { target: layer.object });
  };

  const deleteLayer = (layer: LayerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvas) return;

    canvas.remove(layer.object);
    canvas.renderAll();
  };

  const renameLayer = (layer: LayerItem, newName: string) => {
    layer.object.name = newName;
    canvas?.fire("object:modified", { target: layer.object });
  };

  return (
    <div className="w-56 md:w-64 h-full bg-zinc-950/80 backdrop-blur-xl border border-white/5 rounded-2xl p-3 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="text-sm font-semibold text-white">Layers</h3>
        <span className="text-xs text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full">{layers.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-1">
        {layers.length === 0 ? (
          <div className="text-center text-zinc-600 py-12 flex flex-col items-center">
            <Layers className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-xs">Empty Canvas</p>
          </div>
        ) : (
          layers.map((layer) => (
            <div
              key={layer.id}
              onClick={() => selectLayer(layer)}
              className={cn(
                "group flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all",
                selectedLayerId === layer.id
                  ? "bg-lime-400/10 border-lime-400/30 ring-1 ring-lime-400/20"
                  : "bg-zinc-900/50 border-white/5 hover:border-white/10 hover:bg-white/5"
              )}
            >
              <div className="text-zinc-600 cursor-grab active:cursor-grabbing">
                <GripVertical className="w-3 h-3" />
              </div>

              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={layer.name}
                  onChange={(e) => renameLayer(layer, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-transparent text-xs text-zinc-300 font-medium focus:outline-none focus:text-white"
                />
                <p className="text-[10px] text-zinc-500 truncate">{layer.type}</p>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => toggleVisibility(layer, e)}
                  className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300"
                  title={layer.visible ? "Hide" : "Show"}
                >
                  {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>

                <button
                  onClick={(e) => toggleLock(layer, e)}
                  className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300"
                  title={layer.locked ? "Unlock" : "Lock"}
                >
                  {layer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                </button>

                <button
                  onClick={(e) => deleteLayer(layer, e)}
                  className="p-1 rounded hover:bg-red-400/10 text-zinc-500 hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
