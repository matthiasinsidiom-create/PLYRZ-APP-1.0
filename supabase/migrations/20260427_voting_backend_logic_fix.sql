-- Update trigger to infer match_type if it is still NULL at the time the game finishes
CREATE OR REPLACE FUNCTION public.handle_fixture_voting_window()
RETURNS TRIGGER AS $$
DECLARE
  v_team_name TEXT;
BEGIN
  -- Check if the match was just finalized
  IF NEW.status = 'finished' AND (OLD.status IS DISTINCT FROM 'finished') THEN
    
    -- Always set voting_open_at to the current time when finalized
    NEW.voting_open_at := CURRENT_TIMESTAMP;
    
    -- If match_type is currently NULL, we can try to infer it from the Home Team.
    -- We do this by looking up the team name from public.teams.
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

-- Backfill all existing fixtures that don't have a match_type set
UPDATE public.fixtures f
SET match_type = (
  CASE 
    WHEN (SELECT name FROM public.teams t WHERE t.id = f.home_team_id) ILIKE '%reserve%' OR
         (SELECT name FROM public.teams t WHERE t.id = f.home_team_id) ILIKE '% 1b%' OR
         (SELECT name FROM public.teams t WHERE t.id = f.home_team_id) ILIKE '% 1.b%' OR
         (SELECT name FROM public.teams t WHERE t.id = f.home_team_id) ILIKE '% ii%' OR
         (SELECT name FROM public.teams t WHERE t.id = f.home_team_id) ILIKE '% res%' OR
         (SELECT name FROM public.teams t WHERE t.id = f.home_team_id) ILIKE '% 2. mannschaft%' THEN 'reserve'
    ELSE 'kampfmannschaft'
  END
)
WHERE match_type IS NULL OR match_type = 'kampfmannschaft';
