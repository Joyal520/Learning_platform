-- Run this in your Supabase SQL Editor to support Cloudflare R2-backed media metadata.
-- Existing Supabase-stored submissions remain compatible.

ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS storage_provider TEXT;
