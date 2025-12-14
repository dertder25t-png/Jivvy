"use server";

import { createClient } from "@/utils/supabase/server";

export type UserInfo = {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
};

export async function getCurrentUser(): Promise<{ user: UserInfo | null; error: string | null }> {
    try {
        const supabase = createClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            return { user: null, error: error?.message || "Not authenticated" };
        }

        // Extract name from user metadata (Google OAuth provides this)
        const name = user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            "User";

        const avatarUrl = user.user_metadata?.avatar_url ||
            user.user_metadata?.picture ||
            null;

        return {
            user: {
                id: user.id,
                email: user.email || "",
                name,
                avatarUrl,
            },
            error: null,
        };
    } catch (err) {
        console.error("Error fetching user:", err);
        return { user: null, error: "Failed to fetch user" };
    }
}
