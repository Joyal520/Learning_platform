-- Run this in your Supabase SQL Editor to enable high-performance images

-- 1. Create the public bucket for processed images
INSERT INTO storage.buckets (id, name, public)
VALUES ('approved_public', 'approved_public', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create the private bucket for main files
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions_private', 'submissions_private', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage Policies for 'approved_public'
-- Anyone can view public images
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'approved_public');

-- Authenticated users can upload their own images
CREATE POLICY "Authenticated users can upload images" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'approved_public');

-- Authenticated users can update/overwrite their images (needed for 'upsert: true')
CREATE POLICY "Users can update their own images" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'approved_public');

-- 4. Set up Storage Policies for 'submissions_private'
CREATE POLICY "Owners can upload private files" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'submissions_private');

CREATE POLICY "Owners can view private files" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'submissions_private');
