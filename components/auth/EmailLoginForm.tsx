"use client";

import { useState } from "react";
import { signInWithEmail, signUpWithEmail } from "@/app/auth/actions";
import { Mail, Lock, Loader2 } from "lucide-react";

export function EmailLoginForm() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (formData: FormData) => {
        setLoading(true);
        if (isSignUp) {
            await signUpWithEmail(formData);
        } else {
            await signInWithEmail(formData);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-4">
            <form action={handleSubmit} className="space-y-3">
                <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                        type="email"
                        name="email"
                        placeholder="Email address"
                        required
                        className="w-full h-12 pl-12 pr-4 rounded-2xl bg-zinc-800/50 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50 focus:ring-2 focus:ring-lime-400/20 transition-all"
                    />
                </div>
                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                        type="password"
                        name="password"
                        placeholder="Password"
                        required
                        minLength={6}
                        className="w-full h-12 pl-12 pr-4 rounded-2xl bg-zinc-800/50 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50 focus:ring-2 focus:ring-lime-400/20 transition-all"
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-2xl bg-accent text-accent-foreground font-bold transition-all duration-100 active:scale-95 hover:bg-accent/90 shadow-[0_0_20px_rgba(163,230,53,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <Loader2 className="animate-spin" size={20} />
                    ) : (
                        isSignUp ? "Create Account" : "Sign In"
                    )}
                </button>
            </form>

            <div className="text-center">
                <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-sm text-zinc-400 hover:text-white transition-colors"
                >
                    {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                </button>
            </div>
        </div>
    );
}
