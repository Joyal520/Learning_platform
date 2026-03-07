-- Run this in your Supabase SQL Editor to support the new categories

-- Adding new values to the existing content_category enum
-- Note: 'weird_facts' will remain in the enum for data integrity but will be removed from the UI.
-- If you wish to physically remove 'weird_facts', it involves more complex steps (dropping/recreating the type).

ALTER TYPE public.content_category ADD VALUE IF NOT EXISTS 'classroom_play';
ALTER TYPE public.content_category ADD VALUE IF NOT EXISTS 'speech';
