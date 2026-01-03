"use client";

import React, { useEffect, useRef } from "react";
import { useFabric } from "./useFabric";
import { useProjectStore } from "@/lib/store";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { FabricObject, Rect, IText, Group } from "fabric";

export default function JivvyCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { canvasRef, fabricCanvas } = useFabric(containerRef);
  const { blocks, updateBlock } = useProjectStore();
  const isUpdatingRef = useRef(false);

  // Sync Blocks to Canvas
  useEffect(() => {
    if (!fabricCanvas) return;
    if (isUpdatingRef.current) return;

    // Clear existing (simple approach for now, in real app we'd diff)
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "#18181b";

    blocks.forEach((block) => {
      // Default position if not set
      const left = block.metadata?.position?.x || Math.random() * 400 + 50;
      const top = block.metadata?.position?.y || Math.random() * 400 + 50;

      // Create Card
      const rect = new Rect({
        width: 200,
        height: 100,
        fill: '#27272a', // zinc-800
        rx: 10,
        ry: 10,
        stroke: '#3f3f46', // zinc-700
        strokeWidth: 1
      });

      // Create Text
      // Truncate content
      const textContent = block.content.length > 50 ? block.content.substring(0, 50) + "..." : block.content;

      const text = new IText(textContent || "Empty Block", {
        fontFamily: 'Inter, sans-serif',
        fontSize: 14,
        fill: '#e4e4e7', // zinc-200
        width: 180,
        left: 10,
        top: 10,
        splitByGrapheme: true
      });

      const group = new Group([rect, text], {
        left,
        top,
        subTargetCheck: true,
        hasControls: false, // Disable scaling/rotation for now
        hasBorders: true,
        lockRotation: true
      });

      // Re-assign custom property since 'data' might not be standard in types yet or handled differently
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (group as any).blockId = block.id;

      fabricCanvas.add(group);
    });

    fabricCanvas.renderAll();

  }, [fabricCanvas, blocks]);

  // Handle Canvas Events (Move -> Store)
  useEffect(() => {
    if (!fabricCanvas) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleModified = async (e: any) => {
      const target = e.target;
      if (!target) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
