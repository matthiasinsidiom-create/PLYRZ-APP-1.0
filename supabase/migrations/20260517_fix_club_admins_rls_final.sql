-- 1. Drop existing problematic policies on club_admins
DROP POLICY IF EXISTS "club_admins_read_policy" ON public.club_admins;
DROP POLICY IF EXISTS "club_admins_write_policy" ON public.club_admins;
DROP POLICY IF EXISTS "Admins can view all club_admins" ON public.club_admins;
DROP POLICY IF EXISTS "Club admins can view their own record" ON public.club_admins;
DROP POLICY IF EXISTS "Super admins can manage club_admins" ON public.club_admins;
DROP POLICY IF EXISTS "Users can view their own club_admin records" ON public.club_admins;
DROP POLICY IF EXISTS "Admins can manage club_admins" ON public.club_admins;

-- 2. Enable RLS (just in case)
ALTER TABLE public.club_admins ENABLE ROW LEVEL SECURITY;

-- 3. Create CLEAN policies that do NOT touch auth.users or public.users
-- This avoids the "permission denied for table users" error

-- Policy: Users can read their own club_admin entries
CREATE POLICY "club_admins_read_own"
ON public.club_admins
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy: Main admins can read all entries
-- We check for the 'admin' role in the profiles table.
-- We also allow the specific email from JWT to avoid permissions issues.
CREATE POLICY "club_admins_admin_read_all"
ON public.club_admins
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
  OR (auth.jwt() ->> 'email' = 'matthias.insidiom@gmail.com')
);

-- Policy: Main admins can manage all entries
CREATE POLICY "club_admins_admin_manage"
ON public.club_admins
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
  OR (auth.jwt() ->> 'email' = 'matthias.insidiom@gmail.com')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
  OR (auth.jwt() ->> 'email' = 'matthias.insidiom@gmail.com')
);

-- 4. Fix the can_manage_fixture function to NOT query auth.users directly
CREATE OR REPLACE FUNCTION public.can_manage_fixture(f_id uuid)
RETURNS boolean AS $$
BEGIN
    -- Super Admin check via profiles
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN true;
    END IF;
    
    -- Super Admin check via JWT email (Safe, no table query needed)
    IF (auth.jwt() ->> 'email') = 'matthias.insidiom@gmail.com' THEN
        RETURN true;
    END IF;

    -- Club Admin check
    -- Note: We only query club_admins, fixtures, and teams. All are public tables.
    RETURN EXISTS (
        SELECT 1 
        FROM public.club_admins ca
        JOIN public.fixtures f ON (
            f.home_team_id IN (SELECT id FROM public.teams WHERE club_id = ca.club_id) 
            OR f.away_team_id IN (SELECT id FROM public.teams WHERE club_id = ca.club_id)
        )
        WHERE ca.user_id = auth.uid()
        AND ca.is_active = true
        AND f.id = f_id
        AND (ca.team_scope = 'all' OR ca.team_scope = f.match_type)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Ensure permissions are granted correctly
GRANT SELECT ON public.club_admins TO authenticated;
GRANT SELECT ON public.clubs TO authenticated;
GRANT SELECT ON public.teams TO authenticated;
GRANT SELECT ON public.fixtures TO authenticated;

-- 6. Fix for is_active check if needed (ensure it's indexed)
CREATE INDEX IF NOT EXISTS idx_club_admins_user_active ON public.club_admins(user_id, is_active);
