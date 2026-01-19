"use client";

import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

const convex = new ConvexReactClient(convexUrl);

export default function ConvexClientProvider({
    children,
}: {
    children: ReactNode;
}) {
    // If no URL, we render children (Drive-Only mode fallback basically, 
    // though the app might error if it tries to use Convex hooks. 
    // Ideally we'd have a 'Mock Provider' or better error handling).
    if (!convexUrl) {
        console.warn("NEXT_PUBLIC_CONVEX_URL is not set.");
        return <>{children}</>;
    }

    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
