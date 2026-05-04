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
BEGIN
    -- 1. Fixture laden
    SELECT * INTO v_fixture
    FROM public.fixtures
    WHERE id = p_fixture_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fixture % not found', p_fixture_id;
    END IF;

    -- 2. Match-Type auslesen
    -- Falls match_type vorhanden, prüfen wir Reserve vs Kampfmannschaft
    v_match_type := v_fixture.match_type;

    IF v_match_type = 'reserve' THEN
        v_voting_minutes := 180;
    ELSIF v_match_type = 'kampfmannschaft' THEN
        v_voting_minutes := 60;
    ELSE
        -- Fallback: 60 Minuten
        v_voting_minutes := 60;
    END IF;

    -- 3. Zeitstempel berechnen
    v_open_at := now();
    v_close_at := now() + (v_voting_minutes || ' minutes')::interval;

    -- 4. Fixture aktualisieren
    UPDATE public.fixtures
    SET status = 'finished',
        match_phase = 'full_time',
        voting_open_at = v_open_at,
        voting_close_at = v_close_at,
        results_processed_at = NULL
    WHERE id = p_fixture_id;
    
    -- Cache reset trigger
    NOTIFY pgrst, 'reload schema';

    -- 5. JSON Return
    RETURN json_build_object(
        'match_type', v_match_type,
        'voting_minutes', v_voting_minutes,
        'voting_open_at', v_open_at,
        'voting_close_at', v_close_at,
        'status', 'finished'
    );
END;
$$;
