'use server';

import { createClient } from '@/utils/supabase/server';
import { type Citation } from '@/utils/citation-formatter';
import { revalidatePath } from 'next/cache';

export async function getCitations(projectId: string): Promise<Citation[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Unauthorized');

    const { data, error } = await supabase
        .from('citations')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching citations:', error);
        return [];
    }

    return data as Citation[];
}

export async function createCitation(projectId: string, citation: Omit<Citation, 'id'>) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Unauthorized');

    const { data, error } = await supabase
        .from('citations')
        .insert({
            project_id: projectId,
            user_id: user.id,
            ...citation
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    revalidatePath(`/project/${projectId}`);
    return data;
}

export async function updateCitation(id: string, projectId: string, updates: Partial<Citation>) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Unauthorized');

    const { error } = await supabase
        .from('citations')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id); // Security check

    if (error) throw new Error(error.message);
    revalidatePath(`/project/${projectId}`);
}

export async function deleteCitation(id: string, projectId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Unauthorized');

    const { error } = await supabase
        .from('citations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw new Error(error.message);
    revalidatePath(`/project/${projectId}`);
}
