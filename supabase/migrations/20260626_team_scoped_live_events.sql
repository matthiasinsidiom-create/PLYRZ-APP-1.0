-- Ensure team_id exists
ALTER TABLE public.match_events ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);

-- Update existing match_events without team_id
UPDATE public.match_events me
SET team_id = (
    SELECT fl.team_id 
    FROM public.fixture_lineups fl 
    WHERE fl.fixture_id = me.fixture_id AND fl.player_id = me.player_id 
    LIMIT 1
)
WHERE me.team_id IS NULL AND me.player_id IS NOT NULL;

UPDATE public.match_events me
SET team_id = (
    SELECT p.team_id 
    FROM public.players p 
    WHERE p.id = me.player_id
)
WHERE me.team_id IS NULL AND me.player_id IS NOT NULL;

-- Helper function to check if a user can manage a specific team's live events
CREATE OR REPLACE FUNCTION public.can_manage_match_event(p_fixture_id uuid, p_team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_superadmin boolean;
    v_club_id uuid;
    v_home_team_id uuid;
    v_away_team_id uuid;
    v_match_type text;
    v_has_club_admin boolean;
BEGIN
    -- Check superadmin
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) OR (
        SELECT email = 'matthias.insidiom@gmail.com'
        FROM auth.users
        WHERE id = auth.uid()
    ) INTO v_is_superadmin;

    IF v_is_superadmin THEN
        RETURN true;
    END IF;

    -- Get fixture details
    SELECT home_team_id, away_team_id, match_type
    INTO v_home_team_id, v_away_team_id, v_match_type
    FROM public.fixtures
    WHERE id = p_fixture_id;

    -- Fallback to general fixture access if team is null
    IF p_team_id IS NULL THEN
        RETURN public.can_manage_fixture(p_fixture_id);
    END IF;

    -- Verify team is part of fixture
    IF p_team_id != v_home_team_id AND p_team_id != v_away_team_id THEN
        RETURN false;
    END IF;

    -- Get club_id for the requested team
    SELECT club_id INTO v_club_id FROM public.teams WHERE id = p_team_id;

    -- Check if user is active club_admin for this club and match_type
    SELECT EXISTS (
        SELECT 1 FROM public.club_admins
        WHERE user_id = auth.uid()
        AND club_id = v_club_id
        AND is_active = true
        AND (team_scope = 'all' OR team_scope = v_match_type)
    ) INTO v_has_club_admin;

    IF v_has_club_admin THEN
        RETURN true;
    END IF;

    -- User is not admin for THIS team.
    -- Check if they are admin for the OTHER team in the fixture.
    -- If they are admin for the OTHER team, they can only manage THIS team IF THIS team has NO active club admins.
    DECLARE
        v_other_team_id uuid;
        v_other_club_id uuid;
        v_is_admin_for_other boolean;
        v_this_team_has_any_admins boolean;
    BEGIN
        IF p_team_id = v_home_team_id THEN
            v_other_team_id := v_away_team_id;
        ELSE
            v_other_team_id := v_home_team_id;
        END IF;
        
        SELECT club_id INTO v_other_club_id FROM public.teams WHERE id = v_other_team_id;
        
        -- Check if user is admin for the OTHER team
        SELECT EXISTS (
            SELECT 1 FROM public.club_admins
            WHERE user_id = auth.uid()
            AND club_id = v_other_club_id
            AND is_active = true
            AND (team_scope = 'all' OR team_scope = v_match_type)
        ) INTO v_is_admin_for_other;
        
        IF v_is_admin_for_other THEN
            -- User is admin for the opponent. Can they manage this team?
            -- Only if this team has no admins at all for this match type.
            SELECT EXISTS (
                SELECT 1 FROM public.club_admins
                WHERE club_id = v_club_id
                AND is_active = true
                AND (team_scope = 'all' OR team_scope = v_match_type)
            ) INTO v_this_team_has_any_admins;
            
            IF NOT v_this_team_has_any_admins THEN
                RETURN true;
            END IF;
        END IF;
    END;

    RETURN false;
END;
$$;

-- Re-create policy for match events
DROP POLICY IF EXISTS "club_admins_manage_events" ON public.match_events;
CREATE POLICY "club_admins_manage_events" 
ON public.match_events 
FOR ALL 
TO authenticated
USING (public.can_manage_match_event(fixture_id, team_id))
WITH CHECK (public.can_manage_match_event(fixture_id, team_id));
