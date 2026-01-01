
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        // Local-first fallback: Don't crash if Supabase isn't configured.
        // This allows the app to run in "Offline/No-Backend" mode.
        console.warn("Missing Supabase environment variables. Using mock client.");
        
        return {
            auth: {
                onAuthStateChange: () => {
                    return { data: { subscription: { unsubscribe: () => {} } } };
                },
                getSession: async () => ({ data: { session: null }, error: null }),
                getUser: async () => ({ data: { user: null }, error: null }),
                signInWithOAuth: async () => {
                    console.warn("Supabase not configured: signInWithOAuth ignored");
                    return { error: { message: "Supabase not configured" } };
                },
                signOut: async () => {
                    console.warn("Supabase not configured: signOut ignored");
                    return { error: null };
                }
            },
            // Add other mocks as needed if other parts of the app use them client-side
        } as any;
    }

    return createBrowserClient(
        supabaseUrl,
        supabaseKey
    );
}
