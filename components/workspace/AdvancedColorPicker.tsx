"use client";

import React, { useState, useEffect } from "react";
import { HsvColorPicker } from "react-colorful";
import {
    hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, rgbToCmyk, cmykToRgb,
    RGB, HSV, CMYK
} from "@/utils/colorUtils";

interface AdvancedColorPickerProps {
    color: string; // Hex
    onChange: (hex: string) => void;
    onClose?: () => void;
}

export function AdvancedColorPicker({ color, onChange, onClose }: AdvancedColorPickerProps) {
    const [hsv, setHsv] = useState<HSV>({ h: 0, s: 0, v: 0 });
    const [rgb, setRgb] = useState<RGB>({ r: 0, g: 0, b: 0 });
    const [cmyk, setCmyk] = useState<CMYK>({ c: 0, m: 0, y: 0, k: 0 });
    const [hex, setHex] = useState<string>("#000000");
    const [originalColor] = useState<string>(color);

    useEffect(() => {
        const rgbVal = hexToRgb(color);
        const hsvVal = rgbToHsv(rgbVal);
        const cmykVal = rgbToCmyk(rgbVal);

        setHex(color);
        setRgb(rgbVal);
        setHsv(hsvVal);
        setCmyk(cmykVal);
    }, [color]);

    const updateAll = (newRgb: RGB) => {
        setRgb(newRgb);
        const newHsv = rgbToHsv(newRgb);
        setHsv(newHsv);
        setCmyk(rgbToCmyk(newRgb));
        const newHex = rgbToHex(newRgb);
        setHex(newHex);
        onChange(newHex);
    };

    const handleHsvChange = (newHsv: HSV) => {
        setHsv(newHsv);
        updateAll(hsvToRgb(newHsv));
    };

    const handleHsbInputChange = (key: keyof HSV, value: number) => {
        const newHsv = { ...hsv, [key]: value };
        handleHsvChange(newHsv);
    };

    const handleRgbChange = (key: keyof RGB, value: number) => {
        updateAll({ ...rgb, [key]: value });
    };

    const handleCmykChange = (key: keyof CMYK, value: number) => {
        const newCmyk = { ...cmyk, [key]: value };
        setCmyk(newCmyk);
        // Direct conversion from CMYK to RGB
        const newRgb = cmykToRgb(newCmyk);
        // We call updateAll but we need to prevent CMYK form being overwritten by the round trip immediately
        // to avoid jumping values while typing.
        // Actually for simplicity, we just update everything. Rounding errors might occur (1% diff) but it's acceptable.
        updateAll(newRgb);
    };

    const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setHex(val);
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            const newRgb = hexToRgb(val);
            setRgb(newRgb);
            setHsv(rgbToHsv(newRgb));
            setCmyk(rgbToCmyk(newRgb));
            onChange(val);
        }
    };

    const InputRow = ({ label, value, max, onChange, unit }: {
        label: string,
        value: number,
        max: number,
        onChange: (val: number) => void,
        unit?: string
    }) => (
        <div className="flex items-center gap-2 h-6">
            <div className="w-4 text-[10px] text-zinc-400 font-bold uppercase">{label}</div>
            <input
                type="number"
                value={value}
                onChange={(e) => {
                    let val = parseInt(e.target.value);
                    if (isNaN(val)) val = 0;
                    if (val > max) val = max;
                    if (val < 0) val = 0;
                    onChange(val);
                }}
                className="flex-1 w-full bg-[#1e1e20] border border-white/10 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none focus:border-lime-400/50"
            />
             {unit && <div className="w-3 text-[10px] text-zinc-500">{unit}</div>}
        </div>
    );

    return (
        <div className="flex p-4 bg-[#2a2a2d] w-[560px] h-[340px] text-zinc-200 rounded-3xl shadow-2xl border border-white/10 gap-5">
            {/* Left: Visual Picker */}
            <div className="flex-shrink-0">
                <div className="w-[280px] h-[280px] custom-hsv-picker rounded-xl overflow-hidden shadow-inner border border-white/10">
                    <HsvColorPicker color={hsv} onChange={handleHsvChange} />
                </div>
            </div>

            {/* Right: Controls */}
            <div className="flex-1 flex flex-col gap-3">

                {/* Preview Swatches */}
                <div className="flex items-center gap-4 mb-1">
                    <div className="flex flex-col gap-1 w-full">
                         <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-medium tracking-wider px-1">
                            <span>New</span>
                            <span>Current</span>
                         </div>
                         <div className="h-12 w-full rounded-lg overflow-hidden border border-white/10 flex">
                            <div className="flex-1 h-full" style={{ backgroundColor: hex }} />
                            <div
                                className="flex-1 h-full cursor-pointer hover:opacity-90 transition-opacity"
                                style={{ backgroundColor: originalColor }}
                                onClick={() => handleHexChange({ target: { value: originalColor } } as React.ChangeEvent<HTMLInputElement>)}
                                title="Revert to original"
                            />
                         </div>
                    </div>
                </div>

                <div className="h-px bg-white/5 w-full" />

                <div className="grid grid-cols-2 gap-x-4">
                    {/* Column 1: HSB + RGB */}
                    <div className="flex flex-col gap-1.5">
                        <InputRow label="H" value={hsv.h} max={360} onChange={(v: number) => handleHsbInputChange('h', v)} unit="°" />
                        <InputRow label="S" value={hsv.s} max={100} onChange={(v: number) => handleHsbInputChange('s', v)} unit="%" />
                        <InputRow label="B" value={hsv.v} max={100} onChange={(v: number) => handleHsbInputChange('v', v)} unit="%" />

                        <div className="h-2" />

                        <InputRow label="R" value={rgb.r} max={255} onChange={(v: number) => handleRgbChange('r', v)} />
                        <InputRow label="G" value={rgb.g} max={255} onChange={(v: number) => handleRgbChange('g', v)} />
                        <InputRow label="B" value={rgb.b} max={255} onChange={(v: number) => handleRgbChange('b', v)} />
                    </div>

                    {/* Column 2: CMYK + Hex */}
                    <div className="flex flex-col gap-1.5">
                        <InputRow label="C" value={cmyk.c} max={100} onChange={(v: number) => handleCmykChange('c', v)} unit="%" />
                        <InputRow label="M" value={cmyk.m} max={100} onChange={(v: number) => handleCmykChange('m', v)} unit="%" />
                        <InputRow label="Y" value={cmyk.y} max={100} onChange={(v: number) => handleCmykChange('y', v)} unit="%" />
                        <InputRow label="K" value={cmyk.k} max={100} onChange={(v: number) => handleCmykChange('k', v)} unit="%" />

                        <div className="flex-1" />

                        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                            <span className="text-[10px] text-zinc-400 font-bold">#</span>
                            <input
                                type="text"
                                value={hex}
                                onChange={handleHexChange}
                                className="w-full bg-[#1e1e20] border border-white/10 rounded px-2 py-1 text-xs text-center font-mono focus:outline-none focus:border-lime-400/50 uppercase"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .custom-hsv-picker .react-colorful {
                    width: 100%;
                    height: 100%;
                }
                .custom-hsv-picker .react-colorful__saturation {
                    border-bottom: 0px solid transparent;
                    border-radius: 0;
                    margin-bottom: 0px;
                    /* Custom layout often separates saturation and hue.
                       react-colorful HsvColorPicker bundles them.
                       To match photoshop exactly we need separate components but HsvColorPicker is close enough
                       if we style it to fill the box. */
                    height: 85%;
                    border-radius: 8px 8px 0 0;
                }
                .custom-hsv-picker .react-colorful__hue {
                    height: 15%;
                    border-radius: 0 0 8px 8px;
                    margin-top: 0;
                }
                .custom-hsv-picker .react-colorful__hue-pointer,
                .custom-hsv-picker .react-colorful__saturation-pointer {
                    width: 16px;
                    height: 16px;
                    border: 2px solid white;
                    box-shadow: 0 0 2px rgba(0,0,0,0.5);
                }
            `}</style>
        </div>
    );
}
