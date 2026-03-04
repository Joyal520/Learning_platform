-- Run this in your Supabase SQL Editor to enable ratings and likes on the Explore cards.

-- 1. Drop existing view if it exists (fixes "cannot drop columns" error)
DROP VIEW IF EXISTS public.submission_stats CASCADE;

-- 2. Create a view that aggregates likes and ratings for each submission
CREATE VIEW public.submission_stats AS
SELECT 
    s.id,
    COALESCE(COUNT(DISTINCT l.id), 0) as like_count,
    COALESCE(AVG(r.rating), 0) as avg_rating,
    COALESCE(COUNT(DISTINCT r.id), 0) as rating_count
FROM 
    public.submissions s
LEFT JOIN 
    public.likes l ON s.id = l.submission_id
LEFT JOIN 
    public.ratings r ON s.id = r.submission_id
GROUP BY 
    s.id;

-- 2. Grant permissions so the view is accessible
GRANT SELECT ON public.submission_stats TO anon, authenticated;
