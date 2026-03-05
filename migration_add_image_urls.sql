-- Minimal migration to add thumbnail_url and image_url to submissions
-- Run this in your Supabase SQL Editor

ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Optional: Update RLS if needed, although usually if the table is accessible, 
-- adding columns doesn't break RLS unless specifically restricted by column names.
