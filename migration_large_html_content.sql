-- Run this in your Supabase SQL Editor to safely support large pasted HTML projects.
-- This removes legacy varchar-style limits without changing existing data.

ALTER TABLE public.submissions
  ALTER COLUMN content_text TYPE TEXT;
