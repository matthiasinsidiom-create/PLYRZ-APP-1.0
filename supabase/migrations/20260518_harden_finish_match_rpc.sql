-- Harden finish_fixture_and_open_voting RPC and grant permissions
-- This ensures Team Admins can call this function for their own fixtures

CREATE OR REPLACE FUNCTION public.finish_fixture_and_open_voting(p_fixture_id uuid, p_voting_minutes integer DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fixture record;
    v_voting_minutes integer;
    v_open_at timestamptz;
    v_close_at timestamptz;
    v_match_type text;
    v_is_admin boolean;
BEGIN
    -- 1. Permission check
    -- We use our security definer helper to check if the caller can manage this fixture
    IF NOT public.can_manage_fixture(p_fixture_id) THEN
        RAISE EXCEPTION 'Permission denied: User cannot manage fixture %', p_fixture_id;
    END IF;

    -- 2. Fixture laden
    SELECT * INTO v_fixture
    FROM public.fixtures
    WHERE id = p_fixture_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fixture % not found', p_fixture_id;
    END IF;

    -- 3. Match-Type auslesen
    v_match_type := v_fixture.match_type;

    -- Voting minutes logic (user-provided or based on match_type)
    IF p_voting_minutes IS NOT NULL THEN
        v_voting_minutes := p_voting_minutes;
    ELSIF v_match_type = 'reserve' THEN
        v_voting_minutes := 180; -- 3 Hours
    ELSIF v_match_type = 'kampfmannschaft' THEN
        v_voting_minutes := 60;  -- 1 Hour
    ELSE
        v_voting_minutes := 60;  -- Fallback
    END IF;

    -- 4. Zeitstempel berechnen
    v_open_at := now();
    v_close_at := now() + (v_voting_minutes || ' minutes')::interval;

    -- 5. Fixture aktualisieren
    UPDATE public.fixtures
    SET status = 'finished',
        match_phase = 'full_time',
        voting_open_at = v_open_at,
        voting_close_at = v_close_at,
        results_processed_at = NULL
    WHERE id = p_fixture_id;
    
    -- Cache reset trigger
    NOTIFY pgrst, 'reload schema';

    -- 6. JSON Return
    RETURN json_build_object(
        'match_type', v_match_type,
        'voting_minutes', v_voting_minutes,
        'voting_open_at', v_open_at,
        'voting_close_at', v_close_at,
        'status', 'finished',
        'success', true
    );
END;
$$;

-- Grant EXECUTE permission to authenticated users
GRANT EXECUTE ON FUNCTION public.finish_fixture_and_open_voting(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_fixture_and_open_voting(uuid, integer) TO service_role;
