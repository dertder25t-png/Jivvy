import * as React from "react";
import { cn } from "@/lib/utils";

interface GummyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "solid" | "outline" | "ghost";
    size?: "sm" | "md" | "lg";
}

const GummyButton = React.forwardRef<HTMLButtonElement, GummyButtonProps>(
    ({ className, variant = "solid", size = "md", ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "relative inline-flex items-center justify-center rounded-2xl font-bold transition-transform duration-100 ease-out active:scale-95 disabled:pointer-events-none disabled:opacity-50",
                    {
                        "bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_20px_rgba(163,230,53,0.3)]": variant === "solid",
                        "border-2 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white": variant === "outline",
                        "text-zinc-400 hover:text-white hover:bg-zinc-800/50": variant === "ghost",

                        "h-9 px-4 text-sm": size === "sm",
                        "h-11 px-6 text-base": size === "md",
                        "h-14 px-8 text-lg": size === "lg",
                    },
                    className
                )}
                {...props}
            />
        );
    }
);
GummyButton.displayName = "GummyButton";

export { GummyButton };
