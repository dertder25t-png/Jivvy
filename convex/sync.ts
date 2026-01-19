import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Generic change interface
const ChangeArgs = v.object({
    table: v.string(), // 'projects' | 'blocks' | 'citations' | 'flashcards'
    record: v.any(),   // The record data
    deleted: v.boolean(), // If true, delete the record
});

export const listChanges = query({
    args: {
        since: v.number(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // For prototype, we might skip auth or use a temporary user ID if not using Clerk/etc yet.
            // But let's assume valid auth or throw.
            // throw new Error("Unauthenticated call to listChanges");
            // TEMP: If no auth, return empty or allow for now? 
            // Ideally we use a token. If the user is GUEST locally, they can't sync to global convex without an ID.
            // Let's throw for now, requires auth.
            throw new Error("Unauthenticated");
        }
        const userId = identity.subject;

        const projects = await ctx.db
            .query("projects")
            .withIndex("by_user_id", (q) => q.eq("userId", userId))
            .filter((q) => q.gt(q.field("updated_at"), args.since))
            .collect();

        const blocks = await ctx.db
            .query("blocks")
            .withIndex("by_user_id", (q) => q.eq("userId", userId))
            .filter((q) => q.gt(q.field("updated_at"), args.since))
            .collect();

        const citations = await ctx.db
            .query("citations")
            .withIndex("by_user_id", (q) => q.eq("userId", userId))
            .filter((q) => q.gt(q.field("updated_at"), args.since))
            .collect();

        const flashcards = await ctx.db
            .query("flashcards")
            .withIndex("by_user_id", (q) => q.eq("userId", userId))
            .filter((q) => q.gt(q.field("updated_at"), args.since))
            .collect();

        return {
            projects,
            blocks,
            citations,
            flashcards,
            serverTime: Date.now(),
        };
    },
});

export const pushChanges = mutation({
    args: {
        changes: v.array(ChangeArgs),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthenticated call to pushChanges");
        }
        const userId = identity.subject;

        for (const change of args.changes) {
            const { table, record, deleted } = change;

            let existingRecord = null;
            // Safe queries using the indexes we defined
            if (table === 'projects') existingRecord = await ctx.db.query("projects").withIndex("by_local_id", (q) => q.eq("id", record.id)).unique();
            if (table === 'blocks') existingRecord = await ctx.db.query("blocks").withIndex("by_local_id", (q) => q.eq("id", record.id)).unique();
            if (table === 'citations') existingRecord = await ctx.db.query("citations").withIndex("by_local_id", (q) => q.eq("id", record.id)).unique();
            if (table === 'flashcards') existingRecord = await ctx.db.query("flashcards").withIndex("by_local_id", (q) => q.eq("id", record.id)).unique();

            // Security Check
            if (existingRecord && existingRecord.userId !== userId) {
                console.warn(`Unauthorized attempt to modify record ${record.id} by user ${userId}`);
                continue;
            }

            if (deleted) {
                if (existingRecord) {
                    await ctx.db.delete(existingRecord._id);
                }
            } else {
                if (existingRecord) {
                    // Last Write Wins
                    if (record.updated_at > existingRecord.updated_at) {
                        const { _id, _creationTime, userId: _ignoredUid, ...dataToUpdate } = record;
                        await ctx.db.patch(existingRecord._id, { ...dataToUpdate, userId });
                    }
                } else {
                    // Insert
                    const { _id, _creationTime, sync_status, ...dataToInsert } = record;
                    const finalData = { ...dataToInsert, userId };

                    if (table === 'projects') await ctx.db.insert("projects", finalData);
                    if (table === 'blocks') await ctx.db.insert("blocks", finalData);
                    if (table === 'citations') await ctx.db.insert("citations", finalData);
                    if (table === 'flashcards') await ctx.db.insert("flashcards", finalData);
                }
            }
        }
    },
});
