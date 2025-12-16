-- Create citations table
CREATE TABLE IF NOT EXISTS public.citations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    author TEXT,
    year TEXT,
    type TEXT DEFAULT 'website', -- 'book', 'website', 'journal', 'article'
    url TEXT,
    page TEXT,
    publisher TEXT,
    vol_issue TEXT,
    access_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own citations" ON public.citations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own citations" ON public.citations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own citations" ON public.citations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own citations" ON public.citations
    FOR DELETE USING (auth.uid() = user_id);

-- Realtime
alter publication supabase_realtime add table public.citations;
