-- ============================================================
-- MIGRATION: Add Project Metadata Fields
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Add title column with default value
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS title text DEFAULT 'Untitled Project';

-- Add category column with default value  
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'General';

-- Add updated_at column for tracking changes
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for auto-updating updated_at on projects
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Make pdf_url optional (users can create projects without a PDF)
ALTER TABLE public.projects 
ALTER COLUMN pdf_url DROP NOT NULL;

-- Set default for pdf_url
ALTER TABLE public.projects 
ALTER COLUMN pdf_url SET DEFAULT NULL;

-- Update unique constraint to allow NULL pdf_url
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS unique_pdf_per_user;

-- ============================================================
-- VERIFICATION: Check your changes worked
-- ============================================================
-- Run this to verify the columns were added:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'projects';
