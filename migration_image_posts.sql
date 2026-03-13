-- Run this in your Supabase SQL Editor to support image posts
-- This migration is backward-compatible (existing records get default values)

-- Add image post metadata columns to submissions table
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'project',
  ADD COLUMN IF NOT EXISTS original_size INTEGER,
  ADD COLUMN IF NOT EXISTS compressed_size INTEGER,
  ADD COLUMN IF NOT EXISTS image_width INTEGER,
  ADD COLUMN IF NOT EXISTS image_height INTEGER,
  ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Add index for fast feed queries filtering by content_type
CREATE INDEX IF NOT EXISTS idx_submissions_content_type ON public.submissions (content_type);
