'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
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
    // For Local-First / Convex migration, we default to Guest/Anonymous for now.
    // Real auth can be re-introduced via Convex Auth later.
    const user = null;
    const loading = false;
    const isGuest = true;

    const signInWithGoogle = async () => {
        console.log("Sign in with Google (Not implemented for Auth, usage for Drive only)");
    };

    const signOut = async () => {
        console.log("Sign out");
    };

    return (
        <AuthContext.Provider value={{ user, loading, isGuest, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}
