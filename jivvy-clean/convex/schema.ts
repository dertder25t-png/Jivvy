import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    projects: defineTable({
        id: v.string(), // UUID from Dexie
        title: v.string(),
        parent_project_id: v.optional(v.string()), // For subpages
        created_at: v.number(),
        updated_at: v.number(),
        is_archived: v.boolean(),
        metadata: v.optional(v.any()), // Can store Drive ID for assets here
        userId: v.string(),
    }).index("by_local_id", ["id"]).index("by_user_id", ["userId"]).index("by_parent_project_id", ["parent_project_id"]),

    blocks: defineTable({
        id: v.string(),
        parent_id: v.string(),
        type: v.string(),
        content: v.string(),
        order: v.number(),
        due_date: v.optional(v.number()),
        is_complete: v.optional(v.boolean()),
        metadata: v.optional(v.any()), // Can store Drive ID for assets here
        userId: v.string(),
        updated_at: v.number(),
    })
        .index("by_local_id", ["id"])
        .index("by_parent_id", ["parent_id"])
        .index("by_user_id", ["userId"]),

    citations: defineTable({
        id: v.string(),
        project_id: v.string(),
        type: v.string(),
        title: v.string(),
        author: v.string(),
        year: v.optional(v.string()),
        url: v.optional(v.string()),
        userId: v.string(),
        updated_at: v.number(),
    })
        .index("by_local_id", ["id"])
        .index("by_project_id", ["project_id"])
        .index("by_user_id", ["userId"]),

    flashcards: defineTable({
        id: v.string(),
        project_id: v.string(),
        front: v.string(),
        back: v.string(),
        next_review: v.number(),
        userId: v.string(),
        updated_at: v.number(),
    })
        .index("by_local_id", ["id"])
        .index("by_project_id", ["project_id"])
        .index("by_user_id", ["userId"]),
    calendar_sources: defineTable({
        userId: v.string(),
        url: v.string(),
        name: v.string(),
        color: v.optional(v.string()), // For distinguishing events
        last_synced_at: v.optional(v.number()),
        etag: v.optional(v.string()), // For conditional fetching
    }).index("by_user_id", ["userId"]),
});
