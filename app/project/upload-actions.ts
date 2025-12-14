"use server";

import { createClient } from "@/utils/supabase/server";
import { fileTypeFromBuffer } from "file-type";

export async function uploadImageAction(formData: FormData): Promise<{ url: string | null; error: string | null }> {
    try {
        const file = formData.get("file") as File;
        const userId = formData.get("userId") as string;

        if (!file || !userId) {
            return { url: null, error: "Missing file or user ID" };
        }

        // 1. Validate file size (already checked on client, but check again)
        // 5MB limit
        const MAX_SIZE = 5 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            return { url: null, error: "File size exceeds 5MB limit" };
        }

        // 2. Validate Magic Bytes
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const type = await fileTypeFromBuffer(buffer);

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

        if (!type || !allowedTypes.includes(type.mime)) {
            return { url: null, error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed." };
        }

        // 3. Upload to Supabase Storage
        const supabase = createClient();

        // Verify authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user || user.id !== userId) {
            return { url: null, error: "Unauthorized" };
        }

        const fileExt = type.ext;
        const fileName = `${userId}/${Date.now()}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from('user-images')
            .upload(fileName, file, {
                contentType: type.mime,
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Upload error:', error);
            return { url: null, error: "Storage upload failed" };
        }

        const { data: urlData } = supabase.storage
            .from('user-images')
            .getPublicUrl(data.path);

        return { url: urlData.publicUrl, error: null };

    } catch (error) {
        console.error("Server upload error:", error);
        return { url: null, error: "Internal server error" };
    }
}
