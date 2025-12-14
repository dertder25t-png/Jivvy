-- ============================================================
-- MIGRATION: Create Tasks Table for "The Stream"
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    title text NOT NULL,
    due_date timestamptz NOT NULL,
    status text DEFAULT 'todo' CHECK (status IN ('todo', 'done')),
    category_color text DEFAULT 'zinc',
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own tasks
CREATE POLICY "Users can manage own tasks" ON public.tasks
    FOR ALL USING (auth.uid() = user_id);

-- Index for efficient querying by user and due date
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON public.tasks(user_id, due_date);

-- Grant access
GRANT ALL ON public.tasks TO authenticated;
