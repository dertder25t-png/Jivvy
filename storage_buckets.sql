-- =============================================
-- SUPABASE STORAGE BUCKETS FOR JIVVY
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Create Storage Buckets
-- Note: Buckets are created via Supabase Dashboard or API, not SQL
-- This script sets up the RLS policies for them

-- After creating buckets via Dashboard, run these policies:

-- =============================================
-- BUCKET: briefs (PDF uploads)
-- =============================================

-- Allow authenticated users to upload PDFs to their own folder
CREATE POLICY "Users can upload briefs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'briefs' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own briefs
CREATE POLICY "Users can view own briefs"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'briefs' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own briefs
CREATE POLICY "Users can delete own briefs"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'briefs' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- =============================================
-- BUCKET: user-images (Image uploads)
-- =============================================

CREATE POLICY "Users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'user-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own images"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'user-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'user-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- =============================================
-- BUCKET: canvas-snapshots (Canvas JSON blobs)
-- =============================================

CREATE POLICY "Users can upload snapshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'canvas-snapshots' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own snapshots"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'canvas-snapshots' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own snapshots"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'canvas-snapshots' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- =============================================
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create 3 buckets: "briefs", "user-images", "canvas-snapshots"
-- 3. Set "briefs" as PUBLIC (for PDF viewing)
-- 4. Set others as PRIVATE
-- 5. Run this SQL in SQL Editor to create policies
-- =============================================
