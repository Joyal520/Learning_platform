-- Migration: Add Profile Avatar URL
-- Run this in your Supabase SQL Editor

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update the new_user trigger to optionally extract an initial picture from the OAuth provider if present
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, role, avatar_url)
    VALUES (
        new.id,
        COALESCE(
            new.raw_user_meta_data->>'name', 
            new.raw_user_meta_data->>'full_name',
            new.raw_user_meta_data->>'display_name',
            split_part(new.email, '@', 1)
        ),
        COALESCE(new.raw_user_meta_data->>'role', 'student'),
        -- Capture optional Google/OAuth avatar
        new.raw_user_meta_data->>'avatar_url'
    );
    RETURN new;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.profiles (id, role)
    VALUES (new.id, 'student')
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$;
