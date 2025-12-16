"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type Project = {
    id: string;
    user_id: string;
    title: string;
    category: string;
    pdf_url: string | null;
    extracted_constraints: Record<string, unknown>;
    created_at: string;
    updated_at: string;
};

export type Note = {
    id: string;
    project_id: string;
    content: string;
    order: number;
};

/**
 * Create a new project (optionally with a PDF URL)
 */
export async function createProject(
    pdfUrl?: string,
    title?: string,
    category?: string
): Promise<{ project: Project | null; error: string | null }> {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { project: null, error: "Not authenticated" };
    }

    const { data, error } = await supabase
        .from('projects')
        .insert({
            user_id: user.id,
            title: title || 'Untitled Project',
            category: category || 'General',
            pdf_url: pdfUrl || null,
            extracted_constraints: {}
        })
        .select()
        .single();

    if (error) {
        console.error('Create project error:', error);
        return { project: null, error: error.message };
    }

    revalidatePath('/');
    return { project: data, error: null };
}

/**
 * Get a project by ID
 */
export async function getProject(id: string): Promise<{ project: Project | null; error: string | null }> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        return { project: null, error: error.message };
    }

    return { project: data, error: null };
}

/**
 * Get all projects for the current user
 */
export async function getUserProjects(): Promise<{ projects: Project[]; error: string | null }> {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { projects: [], error: "Not authenticated" };
    }

    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

    if (error) {
        return { projects: [], error: error.message };
    }

    return { projects: data || [], error: null };
}

/**
 * Update project metadata (title, category)
 */
export async function updateProjectMetadata(
    projectId: string,
    updates: { title?: string; category?: string }
): Promise<{ success: boolean; error: string | null }> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .eq('user_id', user.id); // Security: Ensure ownership

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/');
    revalidatePath(`/project/${projectId}`);
    return { success: true, error: null };
}

/**
 * Update project constraints (spec sheet)
 */
export async function updateProjectConstraints(
    projectId: string,
    constraints: Record<string, unknown>
): Promise<{ success: boolean; error: string | null }> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
        .from('projects')
        .update({ extracted_constraints: constraints })
        .eq('id', projectId)
        .eq('user_id', user.id); // Security: Ensure ownership

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath(`/project/${projectId}`);
    return { success: true, error: null };
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id); // Security: Ensure ownership

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/');
    return { success: true, error: null };
}

/**
 * Get project notes
 */
export async function getProjectNotes(projectId: string): Promise<{ notes: Note[]; error: string | null }> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('project_id', projectId)
        .order('order', { ascending: true });

    if (error) {
        console.error("Error fetching notes:", error);
        return { notes: [], error: error.message };
    }

    return { notes: data || [], error: null };
}

/**
 * Save a project note
 * order 0 = Lecture Notes
 * order 1 = Paper
 */
export async function saveProjectNote(projectId: string, content: string, noteOrder: number): Promise<{ success: boolean; error: string | null }> {
    const supabase = createClient();

    // Check if note exists
    const { data: existingNotes, error: fetchError } = await supabase
        .from('notes')
        .select('id')
        .eq('project_id', projectId)
        .eq('order', noteOrder);

    if (fetchError) {
        return { success: false, error: fetchError.message };
    }

    if (existingNotes && existingNotes.length > 0) {
        // Update
        const { error } = await supabase
            .from('notes')
            .update({ content })
            .eq('id', existingNotes[0].id);

        if (error) return { success: false, error: error.message };
    } else {
        // Insert
        const { error } = await supabase
            .from('notes')
            .insert({
                project_id: projectId,
                content,
                order: noteOrder
            });

        if (error) return { success: false, error: error.message };
    }

    return { success: true, error: null };
}
