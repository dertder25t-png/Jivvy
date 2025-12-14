"use client";

import React, { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
    delay?: number;
    noTilt?: boolean;
}

const BentoCard = React.forwardRef<HTMLDivElement, BentoCardProps>(
    ({ className, children, delay = 0, noTilt = false, style, ...props }, ref) => {
        const localRef = useRef<HTMLDivElement>(null);

        React.useImperativeHandle(ref, () => localRef.current as HTMLDivElement);

        const [rotation, setRotation] = useState({ x: 0, y: 0 });
        const [isHovered, setIsHovered] = useState(false);
        const [isVisible, setIsVisible] = useState(false);

        useEffect(() => {
            const timer = setTimeout(() => setIsVisible(true), delay);
            return () => clearTimeout(timer);
        }, [delay]);

        const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
            if (noTilt || !localRef.current) return;
            const rect = localRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Calculate rotation
            const xPct = (x / rect.width) - 0.5;
            const yPct = (y / rect.height) - 0.5;

            // Subtle tilt
            setRotation({ x: -yPct * 8, y: xPct * 8 });
        };

        const handleMouseLeave = () => {
            setIsHovered(false);
            setRotation({ x: 0, y: 0 });
        };

        return (
            <div
                ref={localRef} // Using local ref for mouse events
                onMouseMove={handleMouseMove}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={handleMouseLeave}
                style={{
                    ...style,
                    transform: !noTilt && isVisible
                        ? `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale(${isHovered ? 1.01 : 1})`
                        : undefined,
                    opacity: isVisible ? 1 : 0,
                    transition: "opacity 0.5s ease-out, transform 0.15s ease-out",
                }}
                className={cn(
                    "relative overflow-hidden rounded-[2rem] bg-zinc-900 border border-zinc-800 shadow-xl",
                    className
                )}
                {...props}
            >
                {/* Glow/Sheen Effect */}
                {!noTilt && (
                    <div
                        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                        style={{
                            opacity: isHovered ? 0.15 : 0,
                            background: `linear-gradient(${120 + rotation.y * 5}deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0) 70%)`,
                        }}
                    />
                )}
                {children}
            </div>
        );
    }
);
BentoCard.displayName = "BentoCard";

export { BentoCard };
