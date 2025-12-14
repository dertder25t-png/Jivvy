import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: LucideIcon;
    label: string;
    active?: boolean;
    collapsed?: boolean;
}

const NavButton = React.forwardRef<HTMLButtonElement, NavButtonProps>(
    ({ className, icon: Icon, label, active, collapsed, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "group flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 w-full relative",
                    {
                        "bg-lime-400 text-black shadow-[0_0_15px_rgba(163,230,53,0.3)] font-bold": active,
                        "text-zinc-500 hover:text-white hover:bg-zinc-800": !active,
                        "justify-center": collapsed,
                    },
                    className
                )}
                {...props}
            >
                <Icon size={24} className={cn("shrink-0", { "text-black": active })} />

                {!collapsed && (
                    <span className="text-sm font-medium">{label}</span>
                )}

                {/* Active Indicator Dot for Collapsed Mode */}
                {collapsed && active && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white animate-pulse" />
                )}
            </button>
        );
    }
);
NavButton.displayName = "NavButton";

export { NavButton };
