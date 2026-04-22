-- ====================================================================
-- MIGRATION: Match Lifecycle Automation
-- ====================================================================
-- Description: Automates transitions between match phases.
-- ====================================================================

-- RPC to finish a fixture and open the voting window
CREATE OR REPLACE FUNCTION public.finish_fixture_and_open_voting(
    p_fixture_id UUID,
    p_voting_minutes INTEGER DEFAULT 60
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_voting_close TIMESTAMPTZ;
BEGIN
    -- 1. Verify admin access
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Admin access required');
    END IF;

    -- 2. Calculate voting close time
    v_voting_close := v_now + (p_voting_minutes || ' minutes')::interval;

    -- 3. Update fixture status and window
    UPDATE public.fixtures
    SET 
        status = 'finished',
        match_phase = 'full_time',
        voting_open_at = v_now,
        voting_close_at = v_voting_close,
        results_processed_at = NULL,
        updated_at = v_now
    WHERE id = p_fixture_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Fixture not found');
    END IF;

    RETURN json_build_object(
        'success', true, 
        'voting_open_at', v_now, 
        'voting_close_at', v_voting_close
    );
END;
$$;

-- RPC to start halftime
CREATE OR REPLACE FUNCTION public.start_halftime(p_fixture_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
BEGIN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Admin access required');
    END IF;

    UPDATE public.fixtures
    SET 
        match_phase = 'halftime',
        halftime_started_at = v_now,
        updated_at = v_now
    WHERE id = p_fixture_id;

    RETURN json_build_object('success', true);
END;
$$;

-- RPC to start second half
CREATE OR REPLACE FUNCTION public.start_second_half(p_fixture_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
BEGIN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Admin access required');
    END IF;

    UPDATE public.fixtures
    SET 
        match_phase = 'second_half',
        second_half_started_at = v_now,
        updated_at = v_now
    WHERE id = p_fixture_id;

    RETURN json_build_object('success', true);
END;
$$;
