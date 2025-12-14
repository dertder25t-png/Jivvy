"use client";

import { signInWithGoogle } from "@/app/auth/actions";
import { GummyButton } from "@/components/ui/GummyButton";
import { Chrome } from "lucide-react"; // Using Chrome icon as proxy for Google

export function GoogleLoginButton() {
    return (
        <form action={signInWithGoogle}>
            <GummyButton className="w-full gap-2 bg-white text-black hover:bg-zinc-200" size="lg">
                <Chrome size={20} />
                Continue with Google
            </GummyButton>
        </form>
    );
}
