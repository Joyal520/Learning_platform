-- Run this in your Supabase SQL Editor to enable the bookmark/save feature.

-- 1. Create bookmarks table
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    submission_id UUID REFERENCES public.submissions ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, submission_id)
);

-- 2. Enable Row Level Security
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Users can view their own bookmarks
CREATE POLICY "Users can view own bookmarks" ON public.bookmarks
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own bookmarks
CREATE POLICY "Users can create bookmarks" ON public.bookmarks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own bookmarks
CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks
    FOR DELETE USING (auth.uid() = user_id);

-- 4. Grant permissions
GRANT ALL ON public.bookmarks TO authenticated;
GRANT SELECT ON public.bookmarks TO anon;
