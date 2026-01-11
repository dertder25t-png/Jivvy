import 'fake-indexeddb/auto';
import { db } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';

async function verifyPersistence() {
    console.log("Starting persistence verification...");

    
    // 1. Create a test project
    const projectId = uuidv4();
    const project = {
        id: projectId,
        name: "Persistence Test Project",
        created_at: Date.now(),
        updated_at: Date.now(),
        type: "notebook" as const
    };
    
    try {
        await db.projects.add(project);
        console.log("✅ Project created successfully in IndexedDB");
    } catch (e: any) {
        console.error("❌ Failed to create project:", e);
        return;
    }

    // 2. Create nested block structure
    // Parent -> Child 1 -> Grandchild
    const parentId = uuidv4();
    const childId = uuidv4();
    const grandchildId = uuidv4();

    const parentBlock = {
        id: parentId,
        project_id: projectId, // Important: verify this field exists in Schema
        parent_id: null, // Top level
        content: "Parent Block",
        type: "text" as const,
        order: 0,
        metadata: { variant: "heading1" }
    };

    const childBlock = {
        id: childId,
        project_id: projectId,
        parent_id: parentId,
        content: "Child Block (Indented)",
        type: "text" as const,
        order: 0,
        metadata: { variant: "bullet" }
    };

    const grandchildBlock = {
        id: grandchildId,
        project_id: projectId,
        parent_id: childId,
        content: "Grandchild Block (Deeply Indented)",
        type: "text" as const,
        order: 0,
        metadata: { variant: "bullet" }
    };

    try {
        await db.blocks.add(parentBlock);
        await db.blocks.add(childBlock);
        await db.blocks.add(grandchildBlock);
        console.log("✅ Nested blocks created successfully");
    } catch (e: any) {
        console.error("❌ Failed to create blocks:", e);
    }

    // 3. Verify Retrieval
    const blocks = await db.blocks.where('project_id').equals(projectId).toArray();
    console.log(`Found ${blocks.length} blocks for project ${projectId}`);
    
    if (blocks.length !== 3) {
        console.error("❌ DATA LOSS DETECTED: Expected 3 blocks, found " + blocks.length);
        const ids = blocks.map(b => b.id);
        if (!ids.includes(parentId)) console.error("Missing Parent Block");
        if (!ids.includes(childId)) console.error("Missing Child Block");
        if (!ids.includes(grandchildId)) console.error("Missing Grandchild Block");
    } else {
        console.log("✅ All blocks persisted and retrieved correctly");
    }

    // 4. Test Updates
    try {
        await db.blocks.update(childId, { content: "Updated Child Content" });
        const updatedChild = await db.blocks.get(childId);
        if (updatedChild?.content === "Updated Child Content") {
            console.log("✅ Block update persisted correctly");
        } else {
            console.error("❌ Block update FAILED to persist");
        }
    } catch (e: any) {
        console.error("❌ Update operation threw error:", e);
    }

    // 5. Cleanup
    await db.blocks.where('project_id').equals(projectId).delete();
    await db.projects.delete(projectId);
    console.log("Test data cleaned up.");
}

verifyPersistence().catch(err => console.error(err));
