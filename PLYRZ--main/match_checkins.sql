-- Create match_checkins table
CREATE TABLE IF NOT EXISTS public.match_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    club_id UUID NULL REFERENCES public.clubs(id) ON DELETE SET NULL,
    user_latitude NUMERIC NULL,
    user_longitude NUMERIC NULL,
    venue_latitude NUMERIC NULL,
    venue_longitude NUMERIC NULL,
    radius_meters INTEGER NULL,
    distance_meters NUMERIC NULL,
    is_within_radius BOOLEAN NOT NULL DEFAULT false,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE(fixture_id, user_id)
);

-- Create fixture_vote_completions table
CREATE TABLE IF NOT EXISTS public.fixture_vote_completions (
    fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (fixture_id, user_id)
);

-- Enable RLS
ALTER TABLE public.match_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixture_vote_completions ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'match_checkins' AND policyname = 'Users can view their own check-ins') THEN
        CREATE POLICY "Users can view their own check-ins" ON public.match_checkins FOR SELECT TO authenticated USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fixture_vote_completions' AND policyname = 'Users can view their own completions') THEN
        CREATE POLICY "Users can view their own completions" ON public.fixture_vote_completions FOR SELECT TO authenticated USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fixture_vote_completions' AND policyname = 'Users can insert their own completions') THEN
        CREATE POLICY "Users can insert their own completions" ON public.fixture_vote_completions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- RPC for GPS Check-in
CREATE OR REPLACE FUNCTION public.check_in_to_match(
    p_fixture_id UUID,
    p_user_lat NUMERIC,
    p_user_lon NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_now TIMESTAMPTZ := now();
    v_fixture RECORD;
    v_club RECORD;
    v_distance NUMERIC;
    v_radius INTEGER;
    v_expires_at TIMESTAMPTZ;
    v_checkin_start TIMESTAMPTZ;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Authentication required');
    END IF;

    -- Validate coordinates
    IF p_user_lat IS NULL OR p_user_lon IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User coordinates are required.');
    END IF;

    -- Validate coordinate ranges
    IF p_user_lat < -90 OR p_user_lat > 90 OR p_user_lon < -180 OR p_user_lon > 180 THEN
        RETURN json_build_object('success', false, 'error', 'Invalid coordinate range.');
    END IF;

    -- 1. Check if fixture exists
    SELECT f.*, h.club_id as home_club_id 
    INTO v_fixture 
    FROM public.fixtures f
    JOIN public.teams h ON f.home_team_id = h.id
    WHERE f.id = p_fixture_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Fixture not found');
    END IF;

    -- 2. Check time window (60 mins before kickoff until voting_close_at or 4 hours after kickoff)
    v_checkin_start := v_fixture.kickoff_at - interval '60 minutes';
    v_expires_at := COALESCE(v_fixture.voting_close_at, v_fixture.kickoff_at + interval '4 hours');

    IF v_now < v_checkin_start THEN
        RETURN json_build_object('success', false, 'error', 'Check-in not yet open. Opens 60 mins before kickoff.');
    END IF;

    IF v_now > v_expires_at THEN
        RETURN json_build_object('success', false, 'error', 'Check-in has expired.');
    END IF;

    -- 3. Get Club GPS data
    SELECT * INTO v_club FROM public.clubs WHERE id = v_fixture.home_club_id;
    
    IF NOT FOUND OR v_club.latitude IS NULL OR v_club.longitude IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Venue location not set for this club.');
    END IF;

    v_radius := COALESCE(v_club.radius_meters, 100);

    -- 4. Calculate Distance (Haversine)
    -- R = 6371000 meters
    v_distance := 6371000 * 2 * ASIN(SQRT(
        POWER(SIN((p_user_lat - v_club.latitude) * PI() / 180 / 2), 2) +
        COS(v_club.latitude * PI() / 180) * COS(p_user_lat * PI() / 180) *
        POWER(SIN((p_user_lon - v_club.longitude) * PI() / 180 / 2), 2)
    ));

    -- 5. Upsert Check-in
    INSERT INTO public.match_checkins (
        fixture_id, 
        user_id, 
        club_id, 
        user_latitude, 
        user_longitude, 
        venue_latitude, 
        venue_longitude, 
        radius_meters, 
        distance_meters, 
        is_within_radius, 
        checked_in_at, 
        expires_at
    )
    VALUES (
        p_fixture_id, 
        v_user_id, 
        v_club.id, 
        p_user_lat, 
        p_user_lon, 
        v_club.latitude, 
        v_club.longitude, 
        v_radius, 
        v_distance, 
        v_distance <= v_radius, 
        v_now, 
        v_expires_at
    )
    ON CONFLICT (fixture_id, user_id)
    DO UPDATE SET 
        user_latitude = EXCLUDED.user_latitude,
        user_longitude = EXCLUDED.user_longitude,
        distance_meters = EXCLUDED.distance_meters,
        is_within_radius = EXCLUDED.is_within_radius,
        checked_in_at = EXCLUDED.checked_in_at,
        expires_at = EXCLUDED.expires_at;

    IF v_distance <= v_radius THEN
        RETURN json_build_object(
            'success', true, 
            'message', 'Check-in successful. You are within the radius.',
            'distance', ROUND(v_distance),
            'radius', v_radius
        );
    ELSE
        RETURN json_build_object(
            'success', false, 
            'error', 'You are outside the allowed radius.',
            'distance', ROUND(v_distance),
            'radius', v_radius
        );
    END IF;
END;
$$;

-- Update submit_player_vote to check for valid check-in, valid vote, player in lineup, and team restriction
CREATE OR REPLACE FUNCTION public.submit_player_vote(
    p_fixture_id UUID,
    p_player_id UUID,
    p_vote TEXT,
    p_bypass_checkin BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_now TIMESTAMPTZ := now();
    v_fixture RECORD;
    v_checkin RECORD;
    v_profile RECORD;
    v_user_team_id UUID;
    v_player_team_id UUID;
    v_favorite_club_id UUID;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Authentication required');
    END IF;

    -- 0. Get user profile and determine their team
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Profile not found');
    END IF;

    -- Determine user's team for this fixture
    IF v_profile.role = 'player' THEN
        SELECT team_id INTO v_user_team_id FROM public.players WHERE claimed_by_user_id = v_user_id;
    ELSIF v_profile.role = 'fan' THEN
        -- Safely check for favorite_club_id column existence and value
        -- We use a dynamic check or just check if the column exists in information_schema
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='favorite_club_id') THEN
            -- Use dynamic SQL to avoid compilation error if column is missing
            EXECUTE 'SELECT favorite_club_id FROM public.profiles WHERE id = $1' 
            INTO v_favorite_club_id USING v_user_id;
            
            IF v_favorite_club_id IS NOT NULL THEN
                -- Check if favorite club is playing in this fixture
                SELECT 
                    CASE 
                        WHEN h.club_id = v_favorite_club_id THEN f.home_team_id
                        WHEN a.club_id = v_favorite_club_id THEN f.away_team_id
                        ELSE NULL
                    END INTO v_user_team_id
                FROM public.fixtures f
                JOIN public.teams h ON f.home_team_id = h.id
                JOIN public.teams a ON f.away_team_id = a.id
                WHERE f.id = p_fixture_id;
            END IF;
        END IF;
    END IF;

    -- RESTRICTION BYPASS FOR ADMINS
    RAISE NOTICE 'DEBUG: [VOTE-RPC] User ID: %, Role: %, Team: %, Player Team: %', v_user_id, v_profile.role, v_user_team_id, v_player_team_id;

    -- If no team found, block voting (V1 restriction: everyone needs a team)
    -- EXCEPT for admins who can always vote
    IF v_user_team_id IS NULL AND v_profile.role != 'admin' THEN
        RAISE NOTICE 'DEBUG: [VOTE-RPC] BLOCKED: No team found for non-admin user';
        RETURN json_build_object('success', false, 'error', 'You must belong to one of the teams in this match to vote.');
    END IF;

    -- 1. Validate vote value
    IF p_vote NOT IN ('up', 'down') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid vote value. Must be "up" or "down".');
    END IF;

    -- 2. Check for valid GPS check-in (only if not bypassed)
    IF NOT p_bypass_checkin THEN
        SELECT * INTO v_checkin 
        FROM public.match_checkins 
        WHERE fixture_id = p_fixture_id AND user_id = v_user_id;

        IF NOT FOUND OR NOT v_checkin.is_within_radius OR v_now > v_checkin.expires_at THEN
            RETURN json_build_object('success', false, 'error', 'Valid GPS check-in required to vote.');
        END IF;
    END IF;

    -- 3. Check if fixture exists and voting window is open
    SELECT * INTO v_fixture FROM public.fixtures WHERE id = p_fixture_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Fixture not found');
    END IF;

    -- Check if voting has started
    IF v_fixture.voting_open_at IS NOT NULL AND v_now < v_fixture.voting_open_at THEN
        RETURN json_build_object('success', false, 'error', 'Voting has not started yet.');
    END IF;

    -- Check if voting has closed
    IF v_fixture.voting_close_at IS NOT NULL AND v_now > v_fixture.voting_close_at THEN
        RETURN json_build_object('success', false, 'error', 'Voting has closed');
    END IF;

    -- 4. Check if voting is already completed for this user and fixture
    IF EXISTS (
        SELECT 1 FROM public.fixture_vote_completions 
        WHERE fixture_id = p_fixture_id AND user_id = v_user_id
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Voting already completed for this fixture');
    END IF;

    -- 5. Verify player is actually in the lineup for this fixture
    SELECT team_id INTO v_player_team_id 
    FROM public.fixture_lineups 
    WHERE fixture_id = p_fixture_id AND player_id = p_player_id;

    IF v_player_team_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Player is not in the lineup for this match.');
    END IF;

    -- Restriction: You can only vote for players in your own team (unless admin)
    IF v_profile.role != 'admin' AND v_user_team_id IS NOT NULL AND v_player_team_id != v_user_team_id THEN
        RAISE NOTICE 'DEBUG: [VOTE-RPC] BLOCKED: Team mismatch. User Team: %, Player Team: %', v_user_team_id, v_player_team_id;
        RETURN json_build_object('success', false, 'error', 'You can only vote for players in your own team.');
    END IF;

    -- 6. Upsert vote
    RAISE NOTICE 'DEBUG: [VOTE-RPC] SUCCESS: Writing vote for player %', p_player_id;
    INSERT INTO public.player_votes (fixture_id, player_id, user_id, vote)
    VALUES (p_fixture_id, p_player_id, v_user_id, p_vote)
    ON CONFLICT (fixture_id, player_id, user_id)
    DO UPDATE SET vote = EXCLUDED.vote, created_at = v_now;

    RETURN json_build_object('success', true);
END;
$$;
