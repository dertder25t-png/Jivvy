"use client";

import React, { useEffect, useRef, useState } from "react";
import { useFabric } from "./useFabric";
import { useProjectStore } from "@/lib/store";
import { FabricObject, Rect, IText, Group } from "fabric";

export default function JivvyCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { canvasRef, fabricCanvas } = useFabric(containerRef);
  const { blocks, updateBlock } = useProjectStore();
  const isUpdatingRef = useRef(false);
  const prevBlockIdsRef = useRef<Set<string>>(new Set());

  // Sync Blocks to Canvas with smart diffing (avoid clear() on every render)
  useEffect(() => {
    if (!fabricCanvas) return;
    if (isUpdatingRef.current) return;

    // Initialize background only once
    if (!fabricCanvas.backgroundColor) {
      fabricCanvas.backgroundColor = "#18181b";
    }

    const currentBlockIds = new Set(blocks.map(b => b.id));
    const prevBlockIds = prevBlockIdsRef.current;

    // Get existing canvas objects mapped by blockId
    const canvasObjects = fabricCanvas.getObjects() as (FabricObject & { blockId?: string })[];
    const objectsByBlockId = new Map<string, FabricObject>();
    canvasObjects.forEach(obj => {
      const blockId = (obj as any).blockId;
      if (blockId) objectsByBlockId.set(blockId, obj);
    });

    // Remove deleted blocks from canvas
    prevBlockIds.forEach(id => {
      if (!currentBlockIds.has(id)) {
        const obj = objectsByBlockId.get(id);
        if (obj) {
          fabricCanvas.remove(obj);
        }
      }
    });

    // Add new blocks or update existing ones
    blocks.forEach((block) => {
      const existingObj = objectsByBlockId.get(block.id);

      if (existingObj) {
        // Update existing object position if metadata changed
        const expectedLeft = block.metadata?.position?.x;
        const expectedTop = block.metadata?.position?.y;
        if (expectedLeft !== undefined && expectedTop !== undefined) {
          if (existingObj.left !== expectedLeft || existingObj.top !== expectedTop) {
            existingObj.set({ left: expectedLeft, top: expectedTop });
            existingObj.setCoords();
          }
        }

        // Update text content if changed
        if (existingObj instanceof Group) {
          const textObj = existingObj.getObjects().find(o => o instanceof IText) as IText | undefined;
          if (textObj) {
            const textContent = block.content.length > 50 ? block.content.substring(0, 50) + "..." : block.content;
            if (textObj.text !== textContent) {
              textObj.set({ text: textContent || "Empty Block" });
            }
          }
        }
      } else {
        // Create new block card
        const left = block.metadata?.position?.x || Math.random() * 400 + 50;
        const top = block.metadata?.position?.y || Math.random() * 400 + 50;

        const rect = new Rect({
          width: 200,
          height: 100,
          fill: '#27272a',
          rx: 10,
          ry: 10,
          stroke: '#3f3f46',
          strokeWidth: 1
        });

        const textContent = block.content.length > 50 ? block.content.substring(0, 50) + "..." : block.content;
        const text = new IText(textContent || "Empty Block", {
          fontFamily: 'Inter, sans-serif',
          fontSize: 14,
          fill: '#e4e4e7',
          width: 180,
          left: 10,
          top: 10,
          splitByGrapheme: true
        });

        const group = new Group([rect, text], {
          left,
          top,
          subTargetCheck: true,
          hasControls: false,
          hasBorders: true,
          lockRotation: true
        });

        (group as any).blockId = block.id;
        fabricCanvas.add(group);
      }
    });

    prevBlockIdsRef.current = currentBlockIds;
    fabricCanvas.renderAll();

  }, [fabricCanvas, blocks]);

  // Handle Canvas Events (Move -> Store)
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleModified = async (e: any) => {
      const target = e.target;
      if (!target) return;

      const blockId = (target as any).blockId;
      if (blockId) {
        isUpdatingRef.current = true;
        await updateBlock(blockId, {
          metadata: {
            ...blocks.find(b => b.id === blockId)?.metadata,
            position: { x: target.left, y: target.top }
          }
        });
        isUpdatingRef.current = false;
      }
    };

    fabricCanvas.on("object:modified", handleModified);
    return () => {
      fabricCanvas.off("object:modified", handleModified);
    }
  }, [fabricCanvas, updateBlock, blocks]);

  return (
    <div className="relative w-full h-full bg-zinc-950 overflow-hidden text-white" ref={containerRef}>
      <canvas ref={canvasRef} />

      {/* Simple Help Overlay */}
      <div className="absolute top-4 left-4 pointer-events-none p-2 bg-zinc-900/80 rounded border border-white/5 text-xs text-zinc-400">
        Canvas Mode (Syncs with Editor)
      </div>
    </div>
  );
}
