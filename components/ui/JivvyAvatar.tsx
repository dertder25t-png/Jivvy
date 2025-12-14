import React from "react";

const JivvyAvatar = () => (
    <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0 group cursor-pointer">
        <div className="absolute inset-0 bg-lime-400 rounded-full blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
        <div className="absolute inset-0.5 bg-gradient-to-tr from-lime-300 to-emerald-400 rounded-full flex items-center justify-center overflow-hidden border border-white/20">
            <div className="flex gap-1 relative top-[-1px]">
                <div className="w-1 md:w-1.5 h-2 md:h-2.5 bg-zinc-900 rounded-full animate-blink" />
                <div className="w-1 md:w-1.5 h-2 md:h-2.5 bg-zinc-900 rounded-full animate-blink delay-75" />
            </div>
        </div>
    </div>
);

export { JivvyAvatar };
