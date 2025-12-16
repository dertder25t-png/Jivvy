"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Excalidraw, MainMenu, WelcomeScreen } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types/types";
import { createClient } from "@/utils/supabase/client";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary";

interface ExcalidrawWrapperProps {
    projectId: string;
}

// Helper to ensure we don't pass invalid state that crashes the canvas
const sanitizeAppState = (appState: Partial<AppState>) => {
    if (!appState) return {};

    // Clamp zoom to reasonable limits to prevent "Canvas exceeds max size" error
    // Use 'any' cast for zoomValue to bypass Excalidraw's branded type check
    let zoomValue = appState.zoom?.value || 1;
    if (typeof zoomValue === 'number') {
        if (zoomValue < 0.1) zoomValue = 0.1;
        if (zoomValue > 10) zoomValue = 10;
    }

    // Clamp scroll values to prevent rendering into the void
    const MAX_SCROLL = 50000;
    let scrollX = appState.scrollX || 0;
    let scrollY = appState.scrollY || 0;

    if (Math.abs(scrollX) > MAX_SCROLL) scrollX = 0;
    if (Math.abs(scrollY) > MAX_SCROLL) scrollY = 0;

    return {
        ...appState,
        zoom: { value: zoomValue as any },
        scrollX,
        scrollY,
        theme: "dark",
        viewBackgroundColor: "#09090b",
        gridModeEnabled: false,
        viewModeEnabled: false, // Ensure tools are visible
        zenModeEnabled: false,
    };
};

export default function ExcalidrawWrapper({ projectId }: ExcalidrawWrapperProps) {
    const [elements, setElements] = useState<readonly ExcalidrawElement[]>([]);
    const [appState, setAppState] = useState<Partial<AppState>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [lastSaved, setLastSaved] = useState<number>(Date.now());
    const supabase = createClient();
    const saveTimeoutRef = useRef<NodeJS.Timeout>();

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase.storage
                    .from("project-assets")
                    .download(`canvas/${projectId}.json`);

                if (data) {
                    const text = await data.text();
                    const json = JSON.parse(text);
                    setElements(json.elements || []);
                    if (json.appState) {
                        setAppState(sanitizeAppState(json.appState));
                    }
                }
            } catch (err) {
                console.log("No existing canvas data found, starting fresh.");
            } finally {
                setIsLoading(false);
            }
        };

        if (projectId) {
            loadData();
        }
    }, [projectId]);

    const handleChange = (
        els: readonly ExcalidrawElement[],
        state: AppState,
        files: BinaryFiles
    ) => {
        // Debounced Save
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            if (!projectId) return;

            const content = JSON.stringify({
                elements: els,
                appState: {
                    viewBackgroundColor: state.viewBackgroundColor,
                    currentItemFontFamily: state.currentItemFontFamily,
                    currentItemFontSize: state.currentItemFontSize,
                    zoom: state.zoom,
                    scrollX: state.scrollX,
                    scrollY: state.scrollY
                },
                files,
            });

            const blob = new Blob([content], { type: "application/json" });
            const file = new File([blob], `${projectId}.json`, { type: "application/json" });

            await supabase.storage
                .from("project-assets")
                .upload(`canvas/${projectId}.json`, file, {
                    upsert: true,
                });

            setLastSaved(Date.now());
        }, 2000); // Save every 2 seconds of inactivity
    };

    if (isLoading) {
        return null; // Parent handles loading spinner via dynamic import 'loading' prop
    }

    return (
        <div className="w-full h-full relative">
            <CanvasErrorBoundary>
                <div className="absolute inset-0 overflow-hidden">
                    <Excalidraw
                        theme="dark"
                        initialData={{
                            elements: elements,
                            appState: {
                                ...sanitizeAppState(appState),
                                collaborators: new Map(),
                            },
                            scrollToContent: false,
                        }}
                        onChange={handleChange}
                    >
                        <WelcomeScreen />
                        <MainMenu>
                            <MainMenu.DefaultItems.ClearCanvas />
                            <MainMenu.DefaultItems.SaveAsImage />
                            <MainMenu.DefaultItems.Export />
                            <MainMenu.Separator />
                            <MainMenu.DefaultItems.ToggleTheme />
                            <MainMenu.DefaultItems.ChangeCanvasBackground />
                        </MainMenu>
                    </Excalidraw>
                </div>
            </CanvasErrorBoundary>
        </div>
    );
}
