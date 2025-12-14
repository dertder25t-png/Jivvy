"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export interface CreateFlashcardResult {
    success: boolean;
    error: string | null;
}

/**
 * Create a new flashcard
 */
export async function createFlashcard(
    projectId: string,
    front: string,
    back: string,
    sourceNodeId?: string
): Promise<CreateFlashcardResult> {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
        .from('flashcards')
        .insert({
            project_id: projectId,
            front: front,
            back: back,
            source_node_id: sourceNodeId
        });

    if (error) {
        console.error('Create flashcard error:', error);
        return { success: false, error: error.message };
    }

    revalidatePath(`/project/${projectId}`);
    return { success: true, error: null };
}

/**
 * Get all flashcards for a project
 */
export async function getProjectFlashcards(projectId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    if (error) {
        return { flashcards: [], error: error.message };
    }

    return { flashcards: data || [], error: null };
}
