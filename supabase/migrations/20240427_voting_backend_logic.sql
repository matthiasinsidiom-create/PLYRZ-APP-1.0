-- Add match_type column to fixtures
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS match_type TEXT CHECK (match_type IN ('reserve', 'kampfmannschaft'));

-- Function to handle voting window
CREATE OR REPLACE FUNCTION public.handle_fixture_voting_window()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to 'finished' and it wasn't finished before
  IF NEW.status = 'finished' AND (OLD.status IS DISTINCT FROM 'finished') THEN
    NEW.voting_open_at := CURRENT_TIMESTAMP;
    
    IF NEW.match_type = 'reserve' THEN
      NEW.voting_close_at := CURRENT_TIMESTAMP + INTERVAL '3 hours';
    ELSIF NEW.match_type = 'kampfmannschaft' THEN
      NEW.voting_close_at := CURRENT_TIMESTAMP + INTERVAL '1 hour';
    ELSE
      -- Fallback if match_type is null or something else
      NEW.voting_close_at := CURRENT_TIMESTAMP + INTERVAL '1 hour';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the function
DROP TRIGGER IF EXISTS trigger_fixture_voting_window ON public.fixtures;
CREATE TRIGGER trigger_fixture_voting_window
  BEFORE UPDATE ON public.fixtures
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_fixture_voting_window();

-- Also handle inserts if a fixture is created as 'finished' already (rare but possible)
DROP TRIGGER IF EXISTS trigger_fixture_voting_window_insert ON public.fixtures;
CREATE TRIGGER trigger_fixture_voting_window_insert
  BEFORE INSERT ON public.fixtures
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_fixture_voting_window();
