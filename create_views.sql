-- Run this in your Supabase SQL Editor to enable view counting.

-- 1. Create views table
CREATE TABLE IF NOT EXISTS public.views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    submission_id UUID REFERENCES public.submissions ON DELETE CASCADE NOT NULL,
    viewer_id UUID REFERENCES auth.users ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE public.views ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Anyone can view the views count (needed for aggregation)
CREATE POLICY "Views are viewable by everyone" ON public.views
    FOR SELECT USING (true);

-- Authenticated users can insert views
CREATE POLICY "Authenticated users can insert views" ON public.views
    FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- Allow anonymous views too (viewer_id can be null)
CREATE POLICY "Anonymous users can insert views" ON public.views
    FOR INSERT WITH CHECK (viewer_id IS NULL);

-- 4. Grant permissions
GRANT ALL ON public.views TO authenticated;
GRANT SELECT, INSERT ON public.views TO anon;

-- 5. Update submission_stats view to include view_count
DROP VIEW IF EXISTS public.submission_stats CASCADE;

CREATE VIEW public.submission_stats AS
SELECT 
    s.id,
    COALESCE(COUNT(DISTINCT l.id), 0) as like_count,
    COALESCE(AVG(r.rating), 0) as avg_rating,
    COALESCE(COUNT(DISTINCT r.id), 0) as rating_count,
    COALESCE(COUNT(DISTINCT v.id), 0) as view_count
FROM 
    public.submissions s
LEFT JOIN 
    public.likes l ON s.id = l.submission_id
LEFT JOIN 
    public.ratings r ON s.id = r.submission_id
LEFT JOIN 
    public.views v ON s.id = v.submission_id
GROUP BY 
    s.id;

-- 6. Grant permissions on updated view
GRANT SELECT ON public.submission_stats TO anon, authenticated;
