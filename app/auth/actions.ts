"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";

export async function signInWithGoogle() {
    const supabase = createClient();
    const origin = headers().get("origin") || 'http://localhost:3000';

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: `${origin}/auth/callback`,
        },
    });

    if (error) {
        console.error("Supabase Auth Error:", error);
        return redirect(`/login?message=Auth Error: ${error.message}`);
    }

    return redirect(data.url);
}

export async function signInWithEmail(formData: FormData) {
    const supabase = createClient();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return redirect("/login?message=Email and password are required");
    }

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        console.error("Sign in error:", error);
        return redirect(`/login?message=${encodeURIComponent(error.message)}`);
    }

    return redirect("/");
}

export async function signUpWithEmail(formData: FormData) {
    const supabase = createClient();
    const origin = headers().get("origin") || 'http://localhost:3000';

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return redirect("/login?message=Email and password are required");
    }

    if (password.length < 6) {
        return redirect("/login?message=Password must be at least 6 characters");
    }

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${origin}/auth/callback`,
        },
    });

    if (error) {
        console.error("Sign up error:", error);
        return redirect(`/login?message=${encodeURIComponent(error.message)}`);
    }

    return redirect("/login?message=Check your email for a confirmation link!");
}

export async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    return redirect("/login");
}

