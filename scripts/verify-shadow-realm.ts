
import 'fake-indexeddb/auto';
import { db, deleteBlockRecursively } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';

async function verifyShadowRealmBug() {
    console.log("Starting Shadow Realm (Orphaned Children) verification...");
    
    const projectId = uuidv4();
    
    // Create Parent
    const parentId = uuidv4();
    await db.blocks.add({
        id: parentId,
        project_id: projectId,
        parent_id: null,
        content: "Parent to be deleted",
        type: "text",
        order: 0
    });

    // Create Child
    const childId = uuidv4();
    await db.blocks.add({
        id: childId,
        project_id: projectId,
        parent_id: parentId,
        content: "I should die with my parent",
        type: "text",
        order: 0
    });
    
    // Create Grandchild
    const grandchildId = uuidv4();
    await db.blocks.add({
        id: grandchildId,
        project_id: projectId,
        parent_id: childId,
        content: "I should also die",
        type: "text",
        order: 0
    });

    console.log("✅ Created Parent, Child, and Grandchild");

    // Simulate "Delete" logic now using recursive delete
    console.log("Deleting Parent Recursively...");
    const deletedIds = await deleteBlockRecursively(parentId);
    console.log("Delete returned IDs:", deletedIds);

    // Check if child still exists
    const child = await db.blocks.get(childId);
    const grandchild = await db.blocks.get(grandchildId);
    
    if (child || grandchild) {
        console.error("❌ BUG VERIFIED: Blocks still follow us even after recursive delete!");
        if (child) console.log("Child still alive");
        if (grandchild) console.log("Grandchild still alive");
    } else {
        console.log("✅ SUCCESS: Parent, Child and Grandchild were all deleted. No Shadow Realm inhabitants found.");
    }

    // Cleanup
    await db.blocks.where('project_id').equals(projectId).delete();
}

verifyShadowRealmBug().catch(console.error);
