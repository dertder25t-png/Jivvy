"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Assuming you have an Input component, otherwise I'll use standard input
import { Loader2 } from "lucide-react";

export function SignInForm() {
    const { signIn } = useAuthActions();
    const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await signIn("password", { email, password, flow });
        } catch (err: any) {
            console.error("Login error:", err);
            // Convex Auth throws robust errors, try to display a friendly message
            setError(err.message || "Something went wrong. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8 border border-neutral-100">
            <h2 className="text-2xl font-bold mb-2 text-center text-neutral-800">
                {flow === "signIn" ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="text-sm text-neutral-500 text-center mb-6">
                {flow === "signIn" ? "Sign in to access your workspace" : "Get started with your free account"}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-500"
                        placeholder="you@example.com"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-500"
                        placeholder="••••••••"
                        minLength={8}
                    />
                </div>

                {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                        {error}
                    </div>
                )}

                <Button
                    type="submit"
                    className="w-full h-11 bg-neutral-900 hover:bg-neutral-800 text-white"
                    disabled={loading}
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (flow === "signIn" ? "Sign In" : "Sign Up")}
                </Button>
            </form>

            <div className="mt-6 text-center text-sm">
                <span className="text-neutral-500">
                    {flow === "signIn" ? "Don't have an account? " : "Already have an account? "}
                </span>
                <button
                    type="button"
                    onClick={() => {
                        setFlow(flow === "signIn" ? "signUp" : "signIn");
                        setError("");
                    }}
                    className="font-medium text-neutral-900 hover:underline"
                >
                    {flow === "signIn" ? "Sign up" : "Log in"}
                </button>
            </div>
        </div>
    );
}
