
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addSource = mutation({
    args: {
        url: v.string(),
        name: v.string(),
        color: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const existing = await ctx.db
            .query("calendar_sources")
            .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
            .filter((q) => q.eq(q.field("url"), args.url))
            .first();

        if (existing) {
            return existing._id;
        }

        return await ctx.db.insert("calendar_sources", {
            userId: identity.subject,
            url: args.url,
            name: args.name,
            color: args.color,
            last_synced_at: Date.now(),
        });
    },
});

export const removeSource = mutation({
    args: { id: v.id("calendar_sources") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");
        // Verify ownership
        const source = await ctx.db.get(args.id);
        if (!source || source.userId !== identity.subject) {
            throw new Error("Unauthorized");
        }
        await ctx.db.delete(args.id);
    }
});

export const getSources = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        return await ctx.db
            .query("calendar_sources")
            .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
            .collect();
    },
});

export const updateLastSynced = mutation({
    args: { id: v.id("calendar_sources"), time: v.number() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");
        // Verify ownership
        const source = await ctx.db.get(args.id);
        if (!source || source.userId !== identity.subject) {
            throw new Error("Unauthorized");
        }
        await ctx.db.patch(args.id, { last_synced_at: args.time });
    }
});
