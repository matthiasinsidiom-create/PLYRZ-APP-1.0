# Backend-Driven Voting Window System

## The Missing Link for "1 Hour Reserve Games"
If a reserve match still showed a 1-hour window, it was because the `match_type` column was empty (`NULL`) for existing games, or the frontend wasn't sending it during fixture creation, which forced the backend to default to 1 hour.

We have applied two crucial updates:
1. **Frontend**: When creating or editing a fixture via the admin panel, the system now automatically checks if the Home Team name includes "reserve" and explicitly saves `match_type: 'reserve'` to the database.
2. **Backend**: An improved SQL trigger + a backfill query.

## Next Steps (Required)
You must execute the following SQL script in your Supabase SQL Editor to apply these fixes to **both existing games** and the backend automation.

**File:** `/supabase/migrations/20260427_voting_backend_logic_fix.sql`

```sql
-- 1. Update trigger to infer match_type if it is still NULL at the time the game finishes
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
      
      IF v_team_name ILIKE '%reserve%' THEN
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

-- 2. Backfill all existing fixtures that don't have a match_type set
UPDATE public.fixtures f
SET match_type = (
  CASE 
    WHEN (SELECT name FROM public.teams t WHERE t.id = f.home_team_id) ILIKE '%reserve%' THEN 'reserve'
    ELSE 'kampfmannschaft'
  END
)
WHERE match_type IS NULL;
```

This backfill query will immediately correct any past or upcoming reserve games that were missing their match_type property.

