'use client';

import { useConvexAuth } from "convex/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isDetermined, setIsDetermined] = useState(false);
    const [hasAuthCode, setHasAuthCode] = useState(false);

    useEffect(() => {
        // Check for auth code on mount to prevent premature redirect
        if (typeof window !== 'undefined') {
            const hasCode = window.location.search.includes("code=");
            console.log("[AuthGuard] Checking URL:", window.location.href);
            console.log("[AuthGuard] Has Code?", hasCode);
            setHasAuthCode(hasCode);
        }
    }, []);

    // Safety valve: If we have an auth code but don't authenticate within 10s, give up
    // This prevents infinite loading if the code is invalid or Convex fails to handshake
    useEffect(() => {
        if (hasAuthCode && !isAuthenticated) {
            console.log("[AuthGuard] Waiting for auth...");
            const timer = setTimeout(() => {
                console.log("[AuthGuard] Timeout reached. Authentication failed.");
                setHasAuthCode(false);
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [hasAuthCode, isAuthenticated]);

    useEffect(() => {
        if (!isLoading) {
            setIsDetermined(true);
        }
    }, [isLoading]);

    useEffect(() => {
        if (isAuthenticated && hasAuthCode) {
            console.log("[AuthGuard] Authentication SUCCESS! Clearing code flag.");
            setHasAuthCode(false);
        }
    }, [isAuthenticated, hasAuthCode]);

    useEffect(() => {
        if (!isDetermined) return;

        console.log("[AuthGuard] State Update:", { isAuthenticated, hasAuthCode, pathname });

        // If not authenticated and not on auth page, redirect to auth
        // unless we have an auth code (waiting for Convex to process it)
        if (!isAuthenticated && pathname !== "/auth" && !hasAuthCode) {
            console.log("[AuthGuard] Not authenticated. Redirecting to /auth");
            router.push("/auth");
        }

        // If authenticated and on auth page, redirect to dashboard
        if (isAuthenticated && pathname === "/auth") {
            router.push("/today");
        }
    }, [isAuthenticated, isDetermined, pathname, router, hasAuthCode]);


    // Show loading until we know the auth state OR if we are potentially processing an auth code
    if (!isDetermined || (hasAuthCode && !isAuthenticated)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // On auth page, always render children (login form)
    if (pathname === "/auth") {
        return <>{children}</>;
    }

    // Otherwise render children only if authenticated
    return isAuthenticated ? <>{children}</> : null;
}
