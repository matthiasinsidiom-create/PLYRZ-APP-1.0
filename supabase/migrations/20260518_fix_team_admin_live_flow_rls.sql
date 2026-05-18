-- Fix RLS policies for Team Admins to allow live flow management
-- This migration ensures that club admins can INSERT, UPDATE and DELETE events
-- and update fixture status for games they are responsible for.

-- 1. Hardened can_manage_fixture check (already exists, but we ensure it's used correctly)
-- The function was already defined as SECURITY DEFINER, which is good.

-- 2. Redefine match_events policies
DROP POLICY IF EXISTS "Club Admins can manage match events" ON public.match_events;
DROP POLICY IF EXISTS "club_admins_manage_events" ON public.match_events;

CREATE POLICY "club_admins_manage_events" 
ON public.match_events 
FOR ALL 
TO authenticated
USING (public.can_manage_fixture(fixture_id))
WITH CHECK (public.can_manage_fixture(fixture_id));

-- 3. Redefine fixtures policies for UPDATE
DROP POLICY IF EXISTS "Club Admins can update their fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "club_admins_update_fixtures" ON public.fixtures;

CREATE POLICY "club_admins_update_fixtures" 
ON public.fixtures 
FOR UPDATE 
TO authenticated
USING (public.can_manage_fixture(id))
WITH CHECK (public.can_manage_fixture(id));

-- 4. Ensure fixture_lineups also has the same level of access
DROP POLICY IF EXISTS "Club Admins can manage fixture lineups" ON public.fixture_lineups;
DROP POLICY IF EXISTS "club_admins_manage_lineups" ON public.fixture_lineups;

CREATE POLICY "club_admins_manage_lineups" 
ON public.fixture_lineups 
FOR ALL 
TO authenticated
USING (public.can_manage_fixture(fixture_id))
WITH CHECK (public.can_manage_fixture(fixture_id));

-- 5. Grant necessary permissions
GRANT ALL ON public.match_events TO authenticated;
GRANT ALL ON public.fixtures TO authenticated;
GRANT ALL ON public.fixture_lineups TO authenticated;
