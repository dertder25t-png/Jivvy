"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SignInForm } from "@/components/auth/SignInForm";
import { Loader2 } from "lucide-react";

export default function SignIn() {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const router = useRouter();

    // Redirect authenticated users to dashboard
    useEffect(() => {
        if (isAuthenticated && !isLoading) {
            router.push("/today");
        }
    }, [isAuthenticated, isLoading, router]);


    // Show loading while checking auth
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 p-4">
                <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 p-4">
            <SignInForm />
        </div>
    );
}
