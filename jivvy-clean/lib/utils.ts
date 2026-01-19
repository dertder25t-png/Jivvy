import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function getRandomPastelColor() {
    // Generate soft, pleasing pastel colors
    const hue = Math.floor(Math.random() * 360);
    // Saturation 60-80%, Lightness 70-85%
    return `hsl(${hue}, 70%, 80%)`;
}

export const PASTEL_PALETTE = [
    '#fca5a5', // red
    '#fdba74', // orange
    '#fcd34d', // amber
    '#86efac', // green
    '#67e8f9', // cyan
    '#93c5fd', // blue
    '#c4b5fd', // violet
    '#f0abfc', // fuchsia
    '#fda4af', // rose
    '#cbd5e1', // slate
];

export function getRandomPaletteColor() {
    return PASTEL_PALETTE[Math.floor(Math.random() * PASTEL_PALETTE.length)];
}
