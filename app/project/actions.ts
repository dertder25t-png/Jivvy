"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type Project = {
    id: string;
    user_id: string;
    pdf_url: string;
    extracted_constraints: Record<string, unknown>;
    created_at: string;
};

/**
 * Create a new project with a PDF URL
 */
export async function createProject(pdfUrl: string): Promise<{ project: Project | null; error: string | null }> {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { project: null, error: "Not authenticated" };
    }

    const { data, error } = await supabase
        .from('projects')
        .insert({
            user_id: user.id,
            pdf_url: pdfUrl,
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
        .order('created_at', { ascending: false });

    if (error) {
        return { projects: [], error: error.message };
    }

    return { projects: data || [], error: null };
}

/**
 * Update project constraints (spec sheet)
 */
export async function updateProjectConstraints(
    projectId: string,
    constraints: Record<string, unknown>
): Promise<{ success: boolean; error: string | null }> {
    const supabase = createClient();

    const { error } = await supabase
        .from('projects')
        .update({ extracted_constraints: constraints })
        .eq('id', projectId);

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

    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/');
    return { success: true, error: null };
}
