-- ====================================================================
-- MIGRATION: Fix profiles.id Foreign Key Relationship (Simple Version)
-- ====================================================================

-- 1. Drop the incorrect constraint if it exists
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Add the correct constraint referencing auth.users(id)
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- ====================================================================
-- VERIFICATION QUERIES
-- ====================================================================

-- Confirm ID column type
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles' 
AND column_name = 'id';

-- Confirm table exists and is accessible
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'profiles';
