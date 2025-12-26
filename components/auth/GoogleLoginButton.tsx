"use client";

import { signInWithGoogle } from "@/app/auth/actions";
import { Chrome } from "lucide-react"; // Using Chrome icon as proxy for Google

export function GoogleLoginButton() {
    return (
        <form action={signInWithGoogle}>
            <button className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-black hover:bg-zinc-200 rounded-lg font-medium transition-colors shadow-sm">
                <Chrome size={20} />
                Continue with Google
            </button>
        </form>
    );
}
