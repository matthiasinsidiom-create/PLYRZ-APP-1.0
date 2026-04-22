-- ====================================================================
-- MIGRATION: Add favorite_club_id to profiles (Production Safe)
-- ====================================================================
-- Description: Adds a column to store the user's favorite club with FK and Index.
-- Required for: V1 Team-Restricted Voting for Fans.
-- ====================================================================

-- 1. Add the column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='profiles' AND column_name='favorite_club_id') THEN
        ALTER TABLE public.profiles ADD COLUMN favorite_club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Create an index for performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_profiles_favorite_club_id ON public.profiles(favorite_club_id);

-- 3. Ensure RLS allows users to update their own favorite_club_id
-- Most Supabase projects have a policy like "Users can update own profile" 
-- that checks (auth.uid() = id). If that exists, this column is automatically covered.
-- If you need to explicitly grant permission for this column, uncomment below:
/*
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can update their own favorite club'
    ) THEN
        CREATE POLICY "Users can update their own favorite club" 
        ON public.profiles 
        FOR UPDATE 
        TO authenticated 
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
    END IF;
END $$;
*/

-- 4. VERIFICATION QUERIES
-- Check column existence
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'favorite_club_id';

-- Check foreign key
SELECT
    conname AS constraint_name,
    confrelid::regclass AS referenced_table,
    af.attname AS referenced_column
FROM pg_constraint c
JOIN pg_attribute af ON af.attid = ANY(c.confkey) AND af.attrelid = c.confrelid
WHERE c.conrelid = 'public.profiles'::regclass AND c.contype = 'f';

-- 5. TEST UPDATE (Commented out - run manually with a real UUID if desired)
-- UPDATE public.profiles SET favorite_club_id = 'YOUR_CLUB_UUID_HERE' WHERE id = auth.uid();
