-- Run this in your Supabase SQL Editor to support the new categories

-- Adding new values to the existing content_category enum
ALTER TYPE public.content_category ADD VALUE IF NOT EXISTS 'presentations';
ALTER TYPE public.content_category ADD VALUE IF NOT EXISTS 'flashcards';
