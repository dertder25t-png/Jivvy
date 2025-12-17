"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "fabric";

/**
 * Custom hook to initialize and manage Fabric.js canvas
 * Handles canvas creation, resizing, and cleanup
 */
export function useFabric(containerRef: React.RefObject<HTMLDivElement>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    try {
      // Initialize Fabric canvas
      const canvas = new Canvas(canvasRef.current, {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        backgroundColor: "#18181b", // zinc-900
        selection: true,
        renderOnAddRemove: true,
        enableRetinaScaling: true,
      });

      setFabricCanvas(canvas);

      // ResizeObserver for responsive canvas
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          canvas.setDimensions({ width, height });
          canvas.renderAll();
        }
      });

      resizeObserver.observe(containerRef.current);

      // Cleanup
      return () => {
        resizeObserver.disconnect();
        canvas.dispose();
      };
    } catch (error) {
      console.error("Failed to initialize Fabric canvas:", error);
    }
  }, [containerRef]);

  return { canvasRef, fabricCanvas };
}
