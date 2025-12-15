import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Authentication Error | Jivvy",
    description: "There was a problem signing you in",
};

export default function AuthCodeErrorPage() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-6rem)] p-4">
            <div className="w-full max-w-md space-y-6 bg-surface/50 p-8 rounded-3xl border border-zinc-800 shadow-2xl relative overflow-hidden backdrop-blur-xl">

                {/* Decorative Glow */}
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-red-500/10 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-orange-500/10 rounded-full blur-[80px] pointer-events-none" />

                <div className="flex flex-col items-center gap-4 text-center relative z-10">
                    <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.2)] transform -rotate-6">
                        <AlertTriangle className="text-red-500 w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mt-4">Authentication Error</h1>
                    <p className="text-zinc-400 text-sm">
                        There was a problem signing you in. The link may have expired or is invalid.
                    </p>
                </div>

                <div className="space-y-4 relative z-10">
                    <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-400 text-center">
                        Please try signing in again. If the problem persists, contact support.
                    </div>

                    <Link
                        href="/login"
                        className="w-full flex items-center justify-center py-3 px-4 bg-white hover:bg-zinc-200 text-black font-medium rounded-full transition-colors text-sm"
                    >
                        Return to Login
                    </Link>
                </div>
            </div>
        </div>
    );
}
