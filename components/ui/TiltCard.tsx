"use client";

import React, { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    delay?: number;
    noTilt?: boolean;
}

const TiltCard = ({
    children,
    className = "",
    style = {},
    onClick,
    delay = 0,
    noTilt = false,
    ...props
}: TiltCardProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const [rotation, setRotation] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current || noTilt) return;
        const rect = ref.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Calculate rotation
        const xPct = x / rect.width - 0.5;
        const yPct = y / rect.height - 0.5;

        // More subtle tilt (reduced from 8 to 2)
        setRotation({ x: -yPct * 2, y: xPct * 2 });
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        setRotation({ x: 0, y: 0 });
    };

    return (
        <div
            ref={ref}
            onClick={onClick}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={handleMouseLeave}
            style={{
                ...style,
                transform: isVisible
                    ? (noTilt ? "none" : `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale(${isHovered ? 1.01 : 1})`)
                    : "translateY(50px) scale(0.95)",
                opacity: isVisible ? 1 : 0,
                transition: "opacity 0.5s ease-out, transform 0.15s ease-out",
            }}
            className={cn(
                "relative overflow-hidden cursor-pointer",
                className
            )}
            {...props}
        >
            {/* Refined Glow/Sheen - Softer and more subtle */}
            {!noTilt && (
                <div
                    className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                    style={{
                        opacity: isHovered ? 0.15 : 0, // Lower opacity for better "Glo"
                        background: `linear-gradient(${120 + rotation.y * 5
                            }deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0) 70%)`,
                    }}
                />
            )}
            {children}
        </div>
    );
};

export { TiltCard };
