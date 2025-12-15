"use client";

import { useEditor, useValue, DefaultColorStyle, DefaultDashStyle, DefaultFillStyle, DefaultSizeStyle } from "tldraw";
import { AdvancedColorPicker } from "./AdvancedColorPicker";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { TiltCard } from "@/components/ui/TiltCard";
import {
    Minus,
    MoreHorizontal,
    Activity,
    Square,
    Grid,
    Slash,
    BoxSelect,
    Circle
} from "lucide-react";

// Tldraw standard colors for fallback if arbitrary colors aren't supported
const TLDRAW_COLORS: Record<string, string> = {
    black: "#1e1e1e",
    grey: "#7a7a7a",
    "light-violet": "#cba6f7",
    violet: "#8839ef",
    blue: "#1e66f5",
    "light-blue": "#7287fd",
    yellow: "#df8e1d",
    orange: "#fe640b",
    green: "#40a02b",
    "light-green": "#a6da95",
    "light-red": "#e64553",
    red: "#d20f39",
};

// Helper to find nearest color
function getNearestColor(hex: string): string {
    let minDistance = Infinity;
    let nearestColor = "black";

    // Simple RGB distance
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    Object.entries(TLDRAW_COLORS).forEach(([name, colorHex]) => {
        const cr = parseInt(colorHex.slice(1, 3), 16);
        const cg = parseInt(colorHex.slice(3, 5), 16);
        const cb = parseInt(colorHex.slice(5, 7), 16);

        const distance = Math.sqrt((r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2);
        if (distance < minDistance) {
            minDistance = distance;
            nearestColor = name;
        }
    });

    return nearestColor;
}

export function CustomStylePanel() {
    const editor = useEditor();

    // Track selection state
    const isSomethingSelected = useValue("isSomethingSelected", () => editor.getSelectedShapes().length > 0, [editor]);

    // Track current styles
    const currentColor = useValue("currentColor", () => {
        const val = editor.getSharedStyles().get(DefaultColorStyle);
        if (val && val.type === 'shared') return val.value;
        return 'black';
    }, [editor]);

    const currentFill = useValue("currentFill", () => {
        const val = editor.getSharedStyles().get(DefaultFillStyle);
        if (val && val.type === 'shared') return val.value;
        return 'none';
    }, [editor]);

    const currentDash = useValue("currentDash", () => {
        const val = editor.getSharedStyles().get(DefaultDashStyle);
        if (val && val.type === 'shared') return val.value;
        return 'draw';
    }, [editor]);

    const currentSize = useValue("currentSize", () => {
        const val = editor.getSharedStyles().get(DefaultSizeStyle);
        if (val && val.type === 'shared') return val.value;
        return 'm';
    }, [editor]);

    const currentOpacity = useValue("currentOpacity", () => {
        const shapes = editor.getSelectedShapes();
        if (shapes.length === 0) return 1;
        // Average opacity or first shape's opacity
        return shapes[0].opacity ?? 1;
    }, [editor]);

    // Local state for color picker
    const [showColorPicker, setShowColorPicker] = useState(false);
    const colorPickerRef = useRef<HTMLDivElement>(null);

    // Close color picker when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
                setShowColorPicker(false);
            }
        }
        if (showColorPicker) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showColorPicker]);

    // Handle color change
    const handleColorChange = (hex: string) => {
        // Try to set directly if possible (unlikely with standard shapes),
        // fallback to nearest Tldraw color
        const nearest = getNearestColor(hex);
        const colorValue = nearest as import("tldraw").StylePropValue<typeof DefaultColorStyle>;
        editor.run(() => {
            editor.setStyleForSelectedShapes(DefaultColorStyle, colorValue);
            editor.setStyleForNextShapes(DefaultColorStyle, colorValue);
        });
    };

    // Determine current hex for display
    const currentHex = TLDRAW_COLORS[currentColor as keyof typeof TLDRAW_COLORS] || currentColor;

    if (!isSomethingSelected) return null;

    return (
        <TiltCard
            noTilt
            className="pointer-events-auto flex flex-col gap-4 p-3 bg-[#2a2a2d]/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl w-[200px]"
        >
            {/* Row 1: Color & Opacity */}
            <div className="flex items-center justify-between gap-2">
                <div className="relative">
                    <button
                        className="w-10 h-10 rounded-full border-2 border-white/20 shadow-inner transition-transform hover:scale-110 active:scale-95"
                        style={{ backgroundColor: currentHex }}
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        title="Change Color"
                    />
                    {showColorPicker && (
                        <div
                            ref={colorPickerRef}
                            className="absolute top-12 left-0 z-50 rounded-3xl shadow-2xl"
                        >
                            <AdvancedColorPicker color={currentHex} onChange={handleColorChange} onClose={() => setShowColorPicker(false)} />
                        </div>
                    )}
                </div>

                <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-400 font-medium px-1">Opacity</label>
                    <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.1"
                        value={currentOpacity}
                        onChange={(e) => editor.setOpacityForSelectedShapes(parseFloat(e.target.value))}
                        className="w-full accent-lime-400 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                        title="Adjust Opacity"
                    />
                </div>
            </div>

            <div className="h-px bg-white/10 w-full" />

            {/* Row 2: Fill */}
            <div className="grid grid-cols-4 gap-1">
                {[
                    { value: 'none', icon: BoxSelect, title: 'No Fill' },
                    { value: 'semi', icon: Slash, title: 'Semi Fill' },
                    { value: 'solid', icon: Square, title: 'Solid Fill' },
                    { value: 'pattern', icon: Grid, title: 'Pattern Fill' },
                ].map((item) => (
                    <button
                        key={item.value}
                        onClick={() => {
                            const val = item.value as import("tldraw").StylePropValue<typeof DefaultFillStyle>;
                            editor.run(() => {
                                editor.setStyleForSelectedShapes(DefaultFillStyle, val);
                                editor.setStyleForNextShapes(DefaultFillStyle, val);
                            });
                        }}
                        className={cn(
                            "p-2 rounded-xl flex items-center justify-center transition-colors hover:bg-white/10",
                            currentFill === item.value ? "bg-white/20 text-lime-400" : "text-zinc-400"
                        )}
                        title={item.title}
                    >
                        <item.icon size={16} />
                    </button>
                ))}
            </div>

            {/* Row 3: Dash */}
            <div className="grid grid-cols-4 gap-1">
                {[
                    { value: 'draw', icon: Activity, title: 'Draw' },
                    { value: 'solid', icon: Circle, title: 'Solid Line' }, // Using Circle as a dot/line proxy or just simple line
                    { value: 'dashed', icon: Minus, title: 'Dashed' },
                    { value: 'dotted', icon: MoreHorizontal, title: 'Dotted' },
                ].map((item) => (
                    <button
                        key={item.value}
                        onClick={() => {
                            const val = item.value as import("tldraw").StylePropValue<typeof DefaultDashStyle>;
                            editor.run(() => {
                                editor.setStyleForSelectedShapes(DefaultDashStyle, val);
                                editor.setStyleForNextShapes(DefaultDashStyle, val);
                            });
                        }}
                        className={cn(
                            "p-2 rounded-xl flex items-center justify-center transition-colors hover:bg-white/10",
                            currentDash === item.value ? "bg-white/20 text-lime-400" : "text-zinc-400"
                        )}
                        title={item.title}
                    >
                        <item.icon size={16} />
                    </button>
                ))}
            </div>

             {/* Row 4: Size */}
             <div className="grid grid-cols-4 gap-1">
                {['s', 'm', 'l', 'xl'].map((size) => (
                    <button
                        key={size}
                        onClick={() => {
                            const val = size as import("tldraw").StylePropValue<typeof DefaultSizeStyle>;
                            editor.run(() => {
                                editor.setStyleForSelectedShapes(DefaultSizeStyle, val);
                                editor.setStyleForNextShapes(DefaultSizeStyle, val);
                            });
                        }}
                        className={cn(
                            "p-2 rounded-xl flex items-center justify-center transition-colors hover:bg-white/10 text-xs font-bold uppercase",
                            currentSize === size ? "bg-white/20 text-lime-400" : "text-zinc-400"
                        )}
                        title={`Size ${size.toUpperCase()}`}
                    >
                        {size}
                    </button>
                ))}
            </div>
        </TiltCard>
    );
}
