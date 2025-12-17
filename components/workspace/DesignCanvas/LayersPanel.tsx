"use client";

import React, { useEffect, useState } from "react";
import { Canvas, FabricObject } from "fabric";
import { TiltCard } from "@/components/ui/TiltCard";
import { GummyButton } from "@/components/ui/GummyButton";
import { Eye, EyeOff, Lock, Unlock, Trash2 } from "lucide-react";

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

  useEffect(() => {
    if (!canvas) return;

    // Update layers list when canvas changes
    const updateLayers = () => {
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
    };

    // Initial update
    updateLayers();

    // Listen to canvas events
    canvas.on("object:added", updateLayers);
    canvas.on("object:removed", updateLayers);
    canvas.on("object:modified", updateLayers);

    return () => {
      canvas.off("object:added", updateLayers);
      canvas.off("object:removed", updateLayers);
      canvas.off("object:modified", updateLayers);
    };
  }, [canvas]);

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

  const moveLayerUp = (layer: LayerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvas) return;
    
    const objects = canvas.getObjects();
    const currentIndex = objects.indexOf(layer.object);
    if (currentIndex < objects.length - 1) {
      // Remove and re-add at new position
      canvas.remove(layer.object);
      canvas.insertAt(currentIndex + 1, layer.object);
      canvas.renderAll();
      canvas.fire("object:modified", { target: layer.object });
    }
  };

  const moveLayerDown = (layer: LayerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvas) return;
    
    const objects = canvas.getObjects();
    const currentIndex = objects.indexOf(layer.object);
    if (currentIndex > 0) {
      // Remove and re-add at new position
      canvas.remove(layer.object);
      canvas.insertAt(currentIndex - 1, layer.object);
      canvas.renderAll();
      canvas.fire("object:modified", { target: layer.object });
    }
  };

  const renameLayer = (layer: LayerItem, newName: string) => {
    layer.object.name = newName;
    canvas?.fire("object:modified", { target: layer.object });
  };

  return (
    <TiltCard className="w-80 h-full bg-zinc-900 border-2 border-zinc-700 rounded-2xl p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Layers</h3>
        <span className="text-sm text-zinc-400">{layers.length} objects</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
        {layers.length === 0 ? (
          <div className="text-center text-zinc-500 py-8">
            <p className="text-sm">No objects on canvas</p>
            <p className="text-xs mt-2">Add shapes, text, or images to see layers</p>
          </div>
        ) : (
          layers.map((layer) => (
            <div
              key={layer.id}
              onClick={() => selectLayer(layer)}
              className={`
                group p-3 rounded-xl border-2 cursor-pointer transition-all
                ${
                  selectedLayerId === layer.id
                    ? "bg-lime-400/10 border-lime-400"
                    : "bg-zinc-800 border-zinc-700 hover:border-zinc-600"
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <input
                  type="text"
                  value={layer.name}
                  onChange={(e) => renameLayer(layer, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-transparent text-sm text-white font-medium focus:outline-none"
                />
                <span className="text-xs text-zinc-500 uppercase ml-2">{layer.type}</span>
              </div>

              <div className="flex items-center gap-2">
                <GummyButton
                  size="sm"
                  variant="ghost"
                  onClick={(e) => toggleVisibility(layer, e)}
                  title={layer.visible ? "Hide" : "Show"}
                  className="h-6 px-2"
                >
                  {layer.visible ? (
                    <Eye className="w-3 h-3" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-zinc-500" />
                  )}
                </GummyButton>

                <GummyButton
                  size="sm"
                  variant="ghost"
                  onClick={(e) => toggleLock(layer, e)}
                  title={layer.locked ? "Unlock" : "Lock"}
                  className="h-6 px-2"
                >
                  {layer.locked ? (
                    <Lock className="w-3 h-3 text-zinc-500" />
                  ) : (
                    <Unlock className="w-3 h-3" />
                  )}
                </GummyButton>

                <GummyButton
                  size="sm"
                  variant="ghost"
                  onClick={(e) => moveLayerUp(layer, e)}
                  title="Move Up"
                  className="h-6 px-2"
                >
                  <span className="text-xs">↑</span>
                </GummyButton>

                <GummyButton
                  size="sm"
                  variant="ghost"
                  onClick={(e) => moveLayerDown(layer, e)}
                  title="Move Down"
                  className="h-6 px-2"
                >
                  <span className="text-xs">↓</span>
                </GummyButton>

                <GummyButton
                  size="sm"
                  variant="ghost"
                  onClick={(e) => deleteLayer(layer, e)}
                  title="Delete"
                  className="h-6 px-2 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </GummyButton>
              </div>
            </div>
          ))
        )}
      </div>
    </TiltCard>
  );
}
