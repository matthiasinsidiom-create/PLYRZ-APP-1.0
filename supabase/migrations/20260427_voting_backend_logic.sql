/* 
  1. Add match_type to fixtures table
*/
ALTER TABLE public.fixtures 
ADD COLUMN IF NOT EXISTS match_type TEXT CHECK (match_type IN ('reserve', 'kampfmannschaft'));

/* 
  2. Create the backend function to handle voting window logic
*/
CREATE OR REPLACE FUNCTION public.handle_fixture_voting_window()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the match was just finalized
  IF NEW.status = 'finished' AND (OLD.status IS DISTINCT FROM 'finished') THEN
    
    -- Always set voting_open_at to the current time when finalized
    NEW.voting_open_at := CURRENT_TIMESTAMP;
    
    -- Calculate voting_close_at based on match_type
    IF NEW.match_type = 'reserve' THEN
      NEW.voting_close_at := CURRENT_TIMESTAMP + INTERVAL '3 hours';
    ELSIF NEW.match_type = 'kampfmannschaft' THEN
      NEW.voting_close_at := CURRENT_TIMESTAMP + INTERVAL '1 hour';
    ELSE
      -- Fallback: default to 1 hour if match_type is NULL or unknown
      NEW.voting_close_at := CURRENT_TIMESTAMP + INTERVAL '1 hour';
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/* 
  3. Attach trigger to overwrite any frontend values automatically 
*/
DROP TRIGGER IF EXISTS trigger_fixture_voting_window ON public.fixtures;
CREATE TRIGGER trigger_fixture_voting_window
  BEFORE UPDATE ON public.fixtures
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_fixture_voting_window();
