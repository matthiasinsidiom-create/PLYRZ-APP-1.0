-- Create club_admins table
CREATE TABLE IF NOT EXISTS public.club_admins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    team_scope text NOT NULL DEFAULT 'all' CHECK (team_scope IN ('kampfmannschaft', 'reserve', 'all')),
    role text NOT NULL DEFAULT 'club_manager',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, club_id, team_scope)
);

-- Enable RLS
ALTER TABLE public.club_admins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for club_admins
DROP POLICY IF EXISTS "Users can view their own club_admin records" ON public.club_admins;
CREATE POLICY "Users can view their own club_admin records"
ON public.club_admins FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage club_admins" ON public.club_admins;
CREATE POLICY "Admins can manage club_admins"
ON public.club_admins FOR ALL
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'matthias.insidiom@gmail.com'
);

-- Grant permissions to other tables for club admins
-- We need to identify which tables need RLS updates: fixtures, fixture_lineups, match_events

-- Check for fixture access
CREATE OR REPLACE FUNCTION public.can_manage_fixture(f_id uuid)
RETURNS boolean AS $$
BEGIN
    -- Super Admin check
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN true;
    END IF;
    
    IF (SELECT email FROM auth.users WHERE id = auth.uid()) = 'matthias.insidiom@gmail.com' THEN
        RETURN true;
    END IF;

    -- Club Admin check
    RETURN EXISTS (
        SELECT 1 
        FROM public.club_admins ca
        JOIN public.fixtures f ON (f.home_team_id IN (SELECT id FROM teams WHERE club_id = ca.club_id) OR f.away_team_id IN (SELECT id FROM teams WHERE club_id = ca.club_id))
        WHERE ca.user_id = auth.uid()
        AND ca.is_active = true
        AND f.id = f_id
        AND (ca.team_scope = 'all' OR ca.team_scope = f.match_type)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Fixtures RLS (Allow UPDATE)
DROP POLICY IF EXISTS "Club Admins can update their fixtures" ON public.fixtures;
CREATE POLICY "Club Admins can update their fixtures"
ON public.fixtures FOR UPDATE
USING (public.can_manage_fixture(id));

-- Update Fixture Lineups RLS
DROP POLICY IF EXISTS "Club Admins can manage fixture lineups" ON public.fixture_lineups;
CREATE POLICY "Club Admins can manage fixture lineups"
ON public.fixture_lineups FOR ALL
USING (public.can_manage_fixture(fixture_id));

-- Update Match Events RLS
DROP POLICY IF EXISTS "Club Admins can manage match events" ON public.match_events;
CREATE POLICY "Club Admins can manage match events"
ON public.match_events FOR ALL
USING (public.can_manage_fixture(fixture_id));
