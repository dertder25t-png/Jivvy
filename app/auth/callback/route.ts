import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    // if "next" is in param, use it as the redirect URL
    let next = searchParams.get("next") ?? "/";

    // Security: Validate 'next' param to prevent open redirects
    // Ensure it starts with / and doesn't contain // (protocol relative)
    if (!next.startsWith('/') || next.includes('//')) {
        next = '/';
    }

    if (code) {
        const supabase = createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // TODO: return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
