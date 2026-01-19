'use client';

import React, { createContext, useContext, useState } from 'react';
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { api } from "@/convex/_generated/api";

interface AuthContextType {
    user: any | null;
    loading: boolean;
    isGuest: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isGuest: false,
    signInWithGoogle: async () => { },
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const { signOut: convexSignOut } = useAuthActions();
    const [isGuest, setIsGuest] = useState(false);
    const router = useRouter();

    const userData = useQuery(api.users.viewer);

    // If authenticated, use the data from the server.
    const user = isAuthenticated && userData ? {
        id: userData.subject,
        email: userData.email,
        name: userData.name,
        image: userData.pictureUrl
    } : null;

    // We can also check if we are in "Guest Mode" via local state if we implement that later.

    const signInWithGoogle = async () => {
        // Handled by ConvexAuthActions in the Login page usually.
        // This function is kept for compatibility but might warn or redirect.
        console.warn("Use the Sign In page for authentication.");
        router.push("/auth");
    };

    const signOut = async () => {
        try {
            // 1. Clear session marker
            sessionStorage.removeItem('jivvy_has_session');

            // 2. Nuclear Clean: Wipe local DB to prevent data leaks between users
            await db.delete();

            // 3. Sign out of Convex
            await convexSignOut();

            // 4. Force redirect to auth (db.delete might require a reload to re-open properly on next login)
            window.location.href = "/auth";
        } catch (error) {
            console.error("Logout failed:", error);
            sessionStorage.removeItem('jivvy_has_session');
            // Force redirect anyway
            window.location.href = "/auth";
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading: isLoading, isGuest, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}
