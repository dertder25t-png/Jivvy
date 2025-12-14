import { createClient } from "./client";

/**
 * Upload a PDF file to the briefs storage bucket
 */
export async function uploadPDF(file: File, userId: string): Promise<string | null> {
    const supabase = createClient();

    // Create unique filename with user folder
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
        .from('briefs')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        console.error('Upload error:', error);
        return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('briefs')
        .getPublicUrl(data.path);

    return urlData.publicUrl;
}

/**
 * Upload an image to the user-images storage bucket
 */
export async function uploadImage(file: File, userId: string): Promise<string | null> {
    const supabase = createClient();

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
        .from('user-images')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        console.error('Upload error:', error);
        return null;
    }

    const { data: urlData } = supabase.storage
        .from('user-images')
        .getPublicUrl(data.path);

    return urlData.publicUrl;
}

/**
 * Upload a canvas snapshot JSON blob
 */
export async function uploadCanvasSnapshot(
    blob: Blob,
    userId: string,
    projectId: string
): Promise<string | null> {
    const supabase = createClient();

    const fileName = `${userId}/${projectId}/${Date.now()}.json`;

    const { data, error } = await supabase.storage
        .from('canvas-snapshots')
        .upload(fileName, blob, {
            contentType: 'application/json',
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        console.error('Snapshot upload error:', error);
        return null;
    }

    return data.path;
}

/**
 * Get public URL for a file in a bucket
 */
export function getPublicUrl(bucket: string, path: string): string {
    const supabase = createClient();
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
}

/**
 * Delete a file from storage
 */
export async function deleteFile(bucket: string, path: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.storage.from(bucket).remove([path]);
    return !error;
}
