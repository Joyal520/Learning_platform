-- Run this in your Supabase SQL Editor to fix permission issues

-- 1. Ensure submissions table has RLS enabled
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies if they exist (adjust names if necessary)
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.submissions;
DROP POLICY IF EXISTS "Enable select for users based on author_id" ON public.submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON public.submissions;

-- 3. Create Policy: Anyone can view APPROVED submissions
CREATE POLICY "Anyone can view approved submissions" ON public.submissions
    FOR SELECT USING (status = 'approved');

-- 4. Create Policy: Users can view their OWN submissions regardless of status
CREATE POLICY "Users can view own submissions" ON public.submissions
    FOR SELECT USING (auth.uid() = author_id);

-- 5. Create Policy: Admins can view ALL submissions
-- This uses a join to the profiles table to check the role
CREATE POLICY "Admins can view all submissions" ON public.submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 6. Create Policy: Authenticated users can INSERT their own submissions
CREATE POLICY "Users can insert own submissions" ON public.submissions
    FOR INSERT WITH CHECK (auth.uid() = author_id);

-- 7. Create Policy: Admins and Owners can UPDATE submissions
CREATE POLICY "Admins and owners can update submissions" ON public.submissions
    FOR UPDATE USING (
        auth.uid() = author_id OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
