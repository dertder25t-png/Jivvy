"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Excalidraw, MainMenu, WelcomeScreen } from "@excalidraw/excalidraw";
import { createClient } from "@/utils/supabase/client";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary";

interface ExcalidrawWrapperProps {
    projectId: string;
}

// Helper to ensure we don't pass invalid state that crashes the canvas
const sanitizeAppState = (appState: any) => {
    if (!appState) return {};

    // Clamp zoom to reasonable limits to prevent "Canvas exceeds max size" error
    let zoomValue = appState.zoom?.value;
    if (typeof zoomValue === 'number') {
        if (zoomValue < 0.1) zoomValue = 0.1;
        if (zoomValue > 10) zoomValue = 10;
    } else {
        zoomValue = 1;
    }

    // Clamp scroll values to prevent rendering into the void
    const MAX_SCROLL = 50000;
    let scrollX = Number.isFinite(appState.scrollX) ? appState.scrollX : 0;
    let scrollY = Number.isFinite(appState.scrollY) ? appState.scrollY : 0;

    if (Math.abs(scrollX) > MAX_SCROLL) scrollX = 0;
    if (Math.abs(scrollY) > MAX_SCROLL) scrollY = 0;

    return {
        ...appState,
        zoom: { value: zoomValue },
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
    const [elements, setElements] = useState<any[]>([]);
    const [appState, setAppState] = useState<any>({});
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
        els: any[],
        state: any,
        files: any
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
