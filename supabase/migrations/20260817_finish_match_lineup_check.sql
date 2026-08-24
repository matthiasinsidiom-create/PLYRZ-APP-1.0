-- Update trigger and RPC to skip voting when either team has no lineup players

CREATE OR REPLACE FUNCTION public.handle_fixture_voting_window()
RETURNS TRIGGER AS $$
DECLARE
  v_team_name TEXT;
  v_home_lineup_count INTEGER;
  v_away_lineup_count INTEGER;
BEGIN
  -- Check if the match was just finalized
  IF NEW.status = 'finished' AND (OLD.status IS DISTINCT FROM 'finished') THEN
    -- Count lineup players for both teams
    SELECT COUNT(*) INTO v_home_lineup_count
    FROM public.fixture_lineups
    WHERE fixture_id = NEW.id AND team_id = NEW.home_team_id;

    SELECT COUNT(*) INTO v_away_lineup_count
    FROM public.fixture_lineups
    WHERE fixture_id = NEW.id AND team_id = NEW.away_team_id;

    -- If either team has NO lineup players, skip voting and mark as directly processed!
    IF v_home_lineup_count = 0 OR v_away_lineup_count = 0 THEN
      NEW.voting_open_at := NULL;
      NEW.voting_close_at := NULL;
      IF NEW.results_processed_at IS NULL THEN
        NEW.results_processed_at := CURRENT_TIMESTAMP;
      END IF;
      IF NEW.match_phase IS NULL OR NEW.match_phase = 'upcoming' OR NEW.match_phase = 'first_half' OR NEW.match_phase = 'halftime' OR NEW.match_phase = 'second_half' THEN
        NEW.match_phase := 'full_time';
      END IF;
      RETURN NEW;
    END IF;

    -- If we have lineups for both teams, set voting window:
    NEW.voting_open_at := CURRENT_TIMESTAMP;

    -- If match_type is currently NULL, infer from Home Team
    IF NEW.match_type IS NULL THEN
      SELECT name INTO v_team_name FROM public.teams WHERE id = NEW.home_team_id;
      
      IF v_team_name ILIKE '%reserve%' OR
         v_team_name ILIKE '% 1b%' OR
         v_team_name ILIKE '% 1.b%' OR
         v_team_name ILIKE '% ii%' OR
         v_team_name ILIKE '% res%' OR
         v_team_name ILIKE '% 2. mannschaft%' THEN
        NEW.match_type := 'reserve';
      ELSE
        NEW.match_type := 'kampfmannschaft';
      END IF;
    END IF;

    -- Calculate voting_close_at based on match_type
    IF NEW.match_type = 'reserve' THEN
      NEW.voting_close_at := CURRENT_TIMESTAMP + INTERVAL '3 hours';
    ELSIF NEW.match_type = 'kampfmannschaft' THEN
      NEW.voting_close_at := CURRENT_TIMESTAMP + INTERVAL '1 hour';
    ELSE
      -- Fallback
      NEW.voting_close_at := CURRENT_TIMESTAMP + INTERVAL '1 hour';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


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
    v_home_lineup_count integer;
    v_away_lineup_count integer;
BEGIN
    -- 1. Permission check
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

    -- 3. Check lineup counts for both teams
    SELECT COUNT(*) INTO v_home_lineup_count
    FROM public.fixture_lineups
    WHERE fixture_id = p_fixture_id AND team_id = v_fixture.home_team_id;

    SELECT COUNT(*) INTO v_away_lineup_count
    FROM public.fixture_lineups
    WHERE fixture_id = p_fixture_id AND team_id = v_fixture.away_team_id;

    -- If either team has 0 players in lineup: finish match WITHOUT voting
    IF v_home_lineup_count = 0 OR v_away_lineup_count = 0 THEN
        UPDATE public.fixtures
        SET status = 'finished',
            match_phase = 'full_time',
            voting_open_at = NULL,
            voting_close_at = NULL,
            results_processed_at = now()
        WHERE id = p_fixture_id;

        NOTIFY pgrst, 'reload schema';

        RETURN json_build_object(
            'match_type', v_fixture.match_type,
            'has_voting', false,
            'voting_open_at', NULL,
            'voting_close_at', NULL,
            'status', 'finished',
            'success', true,
            'message', 'Match finished directly without voting (incomplete lineups)'
        );
    END IF;

    -- 4. Match-Type auslesen & calculate voting duration
    v_match_type := v_fixture.match_type;

    IF p_voting_minutes IS NOT NULL THEN
        v_voting_minutes := p_voting_minutes;
    ELSIF v_match_type = 'reserve' THEN
        v_voting_minutes := 180; -- 3 Hours
    ELSIF v_match_type = 'kampfmannschaft' THEN
        v_voting_minutes := 60;  -- 1 Hour
    ELSE
        v_voting_minutes := 60;  -- Fallback
    END IF;

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

    NOTIFY pgrst, 'reload schema';

    -- 6. JSON Return
    RETURN json_build_object(
        'match_type', v_match_type,
        'has_voting', true,
        'voting_minutes', v_voting_minutes,
        'voting_open_at', v_open_at,
        'voting_close_at', v_close_at,
        'status', 'finished',
        'success', true
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_fixture_and_open_voting(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_fixture_and_open_voting(uuid, integer) TO service_role;
