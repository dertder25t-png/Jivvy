import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ... imports

/**
 * Stores the current user in the `users` table.
 * Should be called after authentication to ensure the user record exists.
 */
export const store = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Called storeUser without authentication present");
        }

        // Check if we've already stored this user
        const user = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", identity.email!))
            .unique();

        if (user !== null) {
            // If we've seen this user before, update their name/image if changed
            if (user.name !== identity.name || user.image !== identity.pictureUrl) {
                await ctx.db.patch(user._id, {
                    name: identity.name,
                    image: identity.pictureUrl,
                });
            }
            return user._id;
        }

        // If it's a new user, create them
        const newUserId = await ctx.db.insert("users", {
            email: identity.email!,
            name: identity.name,
            image: identity.pictureUrl,
            // storagePreference removed to align with default authTables schema
        });
        return newUserId;
    },
});

export const getPreference = query({
    args: {},
    handler: async (ctx) => {
        // storagePreference is not in default schema, returning default
        return "convex-only";
    }
});

export const viewer = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }
        return identity;
    },
});
