import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { EmailLoginForm } from "@/components/auth/EmailLoginForm";
import { Sparkles } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Login | Jivvy",
    description: "Sign in to your Jivvy account",
};

export default function LoginPage({ searchParams }: { searchParams: { message: string } }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-6rem)] p-4">
            <div className="w-full max-w-md space-y-6 bg-zinc-900/50 p-8 rounded-[2.5rem] border border-zinc-800 shadow-2xl relative overflow-hidden backdrop-blur-xl">

                {/* Decorative Glow */}
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-lime-400/20 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-violet-500/20 rounded-full blur-[80px] pointer-events-none" />

                <div className="flex flex-col items-center gap-4 text-center relative z-10">
                    <div className="w-16 h-16 bg-lime-400 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(163,230,53,0.4)] transform -rotate-6">
                        <Sparkles className="text-black w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mt-4">Welcome Back</h1>
                    <p className="text-zinc-400">Sign in to continue your exploration.</p>
                </div>

                {searchParams?.message && (
                    <div className={`p-4 rounded-2xl text-sm text-center font-medium relative z-10 ${searchParams.message.includes("Check your email")
                            ? "bg-lime-500/10 border border-lime-500/20 text-lime-400"
                            : "bg-red-500/10 border border-red-500/20 text-red-400"
                        }`}>
                        {searchParams.message}
                    </div>
                )}

                <div className="space-y-4 relative z-10">
                    {/* Email Login Form */}
                    <EmailLoginForm />

                    {/* Divider */}
                    <div className="flex items-center gap-4">
                        <div className="flex-1 h-px bg-zinc-700" />
                        <span className="text-xs text-zinc-500 uppercase tracking-widest">or</span>
                        <div className="flex-1 h-px bg-zinc-700" />
                    </div>

                    {/* Google Login */}
                    <GoogleLoginButton />
                </div>

                <div className="text-center text-xs text-zinc-600 relative z-10">
                    By continuing, you agree to our Terms of Service and Privacy Policy.
                </div>
            </div>
        </div>
    );
}

