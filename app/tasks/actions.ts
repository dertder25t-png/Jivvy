"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export interface Task {
    id: string;
    user_id: string;
    project_id: string | null;
    title: string;
    due_date: string;
    status: 'todo' | 'done';
    category_color: string;
    created_at: string;
}

/**
 * Get all tasks for the current user, ordered by due date
 */
export async function getUserTasks(): Promise<{ tasks: Task[]; error: string | null }> {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { tasks: [], error: "Not authenticated" };
    }

    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true });

    if (error) {
        return { tasks: [], error: error.message };
    }

    return { tasks: data || [], error: null };
}

/**
 * Create a new task
 */
export async function createTask(
    title: string,
    dueDate: Date,
    projectId?: string,
    categoryColor?: string
): Promise<{ task: Task | null; error: string | null }> {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { task: null, error: "Not authenticated" };
    }

    const { data, error } = await supabase
        .from('tasks')
        .insert({
            user_id: user.id,
            project_id: projectId || null,
            title: title,
            due_date: dueDate.toISOString(),
            category_color: categoryColor || 'zinc',
            status: 'todo'
        })
        .select()
        .single();

    if (error) {
        return { task: null, error: error.message };
    }

    revalidatePath('/');
    return { task: data, error: null };
}

/**
 * Update task status (toggle done/todo)
 */
export async function updateTaskStatus(
    taskId: string,
    status: 'todo' | 'done'
): Promise<{ success: boolean; error: string | null }> {
    const supabase = await createClient();

    const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/');
    return { success: true, error: null };
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = await createClient();

    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/');
    return { success: true, error: null };
}
