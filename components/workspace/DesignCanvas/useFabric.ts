"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas } from "fabric";

// Debounce utility
function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Custom hook to initialize and manage Fabric.js canvas
 * Optimized with:
 * - GPU acceleration via CSS hints
 * - Debounced resize handling
 * - Idle detection to pause rendering when user is inactive
 * - requestAnimationFrame for smooth rendering
 */
export function useFabric(containerRef: React.RefObject<HTMLDivElement>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);
  const isIdleRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const renderLoopRef = useRef<number>();

  // Idle detection: pause rendering after 3 seconds of no interaction
  const IDLE_THRESHOLD = 3000;

  const markActive = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (isIdleRef.current) {
      isIdleRef.current = false;
      // Resume render loop when becoming active
      startRenderLoop();
    }
  }, []);

  const startRenderLoop = useCallback(() => {
    const canvas = fabricCanvas;
    if (!canvas) return;

    const loop = () => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;

      if (timeSinceActivity > IDLE_THRESHOLD) {
        // Enter idle mode - stop the loop
        isIdleRef.current = true;
        return;
      }

      // Only render if not idle
      if (!isIdleRef.current) {
        canvas.renderAll();
      }

      renderLoopRef.current = requestAnimationFrame(loop);
    };

    // Cancel any existing loop
    if (renderLoopRef.current) {
      cancelAnimationFrame(renderLoopRef.current);
    }

    renderLoopRef.current = requestAnimationFrame(loop);
  }, [fabricCanvas]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    try {
      const container = containerRef.current;

      // Apply GPU acceleration hints
      container.style.willChange = "transform";
      container.style.transform = "translateZ(0)";

      // Initialize Fabric canvas with optimized settings
      const canvas = new Canvas(canvasRef.current, {
        width: container.clientWidth,
        height: container.clientHeight,
        backgroundColor: "#18181b", // zinc-900
        selection: true,
        renderOnAddRemove: false, // Manual render control for optimization
        enableRetinaScaling: true,
      });

      setFabricCanvas(canvas);

      // Debounced resize handler (100ms delay)
      const handleResize = debounce((entries: ResizeObserverEntry[]) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          canvas.setDimensions({ width, height });
          canvas.requestRenderAll();
        }
      }, 100);

      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);

      // Activity tracking for idle detection
      const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "wheel"];

      const handleActivity = () => {
        lastActivityRef.current = Date.now();
        if (isIdleRef.current) {
          isIdleRef.current = false;
        }
      };

      activityEvents.forEach((event) => {
        container.addEventListener(event, handleActivity, { passive: true });
      });

      // Canvas-specific events that should trigger render
      canvas.on("object:added", () => {
        markActive();
        canvas.requestRenderAll();
      });
      canvas.on("object:removed", () => {
        markActive();
        canvas.requestRenderAll();
      });
      canvas.on("object:modified", () => {
        markActive();
        canvas.requestRenderAll();
      });
      canvas.on("mouse:down", markActive);
      canvas.on("mouse:move", markActive);

      // Cleanup
      return () => {
        resizeObserver.disconnect();
        activityEvents.forEach((event) => {
          container.removeEventListener(event, handleActivity);
        });
        if (renderLoopRef.current) {
          cancelAnimationFrame(renderLoopRef.current);
        }
        if (idleTimeoutRef.current) {
          clearTimeout(idleTimeoutRef.current);
        }
        // Remove GPU hints
        container.style.willChange = "";
        container.style.transform = "";
        canvas.dispose();
      };
    } catch (error) {
      console.error("Failed to initialize Fabric canvas:", error);
    }
  }, [containerRef, markActive]);

  // Start render loop when canvas is ready
  useEffect(() => {
    if (fabricCanvas) {
      // Initial render
      fabricCanvas.renderAll();
    }
  }, [fabricCanvas]);

  return { canvasRef, fabricCanvas, markActive };
}
