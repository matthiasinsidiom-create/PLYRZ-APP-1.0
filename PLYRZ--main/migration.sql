-- Match Events System Migration
DROP TABLE IF EXISTS fixture_events;

-- Create match_events table
CREATE TABLE IF NOT EXISTS public.match_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    team_id UUID NULL REFERENCES public.teams(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'starting_xi', 
        'sub_in', 
        'sub_out', 
        'goal', 
        'assist', 
        'yellow_card', 
        'red_card', 
        'clean_sheet', 
        'penalty_saved', 
        'penalty_missed'
    )),
    minute INTEGER NULL,
    extra_minute INTEGER NOT NULL DEFAULT 0 CHECK (extra_minute >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indices
CREATE INDEX IF NOT EXISTS idx_match_events_fixture_id ON public.match_events(fixture_id);
CREATE INDEX IF NOT EXISTS idx_match_events_player_id ON public.match_events(player_id);
CREATE INDEX IF NOT EXISTS idx_match_events_fixture_player ON public.match_events(fixture_id, player_id);

-- Extend player_rating_history table
ALTER TABLE public.player_rating_history ALTER COLUMN delta_overall TYPE NUMERIC;
ALTER TABLE public.player_rating_history ADD COLUMN IF NOT EXISTS votes_up INTEGER DEFAULT 0;
ALTER TABLE public.player_rating_history ADD COLUMN IF NOT EXISTS votes_down INTEGER DEFAULT 0;
ALTER TABLE public.player_rating_history ADD COLUMN IF NOT EXISTS expected_score NUMERIC DEFAULT 0;
ALTER TABLE public.player_rating_history ADD COLUMN IF NOT EXISTS actual_score NUMERIC DEFAULT 0;
ALTER TABLE public.player_rating_history ADD COLUMN IF NOT EXISTS participation_multiplier NUMERIC DEFAULT 1.0;
ALTER TABLE public.player_rating_history ADD COLUMN IF NOT EXISTS vote_impact NUMERIC DEFAULT 0;
ALTER TABLE public.player_rating_history ADD COLUMN IF NOT EXISTS result_impact NUMERIC DEFAULT 0;
ALTER TABLE public.player_rating_history ADD COLUMN IF NOT EXISTS rating_version TEXT DEFAULT '1.0';

-- Enable RLS for match_events
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

-- Create policies for match_events
CREATE POLICY "Allow authenticated users to read match_events" 
ON public.match_events FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow admins to manage match_events" 
ON public.match_events FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Enable RLS for player_rating_history
ALTER TABLE public.player_rating_history ENABLE ROW LEVEL SECURITY;

-- Create policies for player_rating_history
CREATE POLICY "Allow authenticated users to read player_rating_history" 
ON public.player_rating_history FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow admins to manage player_rating_history" 
ON public.player_rating_history FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Secure grants: Only service_role and postgres get full access
-- authenticated and anon only get SELECT where needed for the UI
GRANT USAGE ON SCHEMA public TO postgres, service_role, authenticated, anon;

GRANT ALL ON TABLE public.match_events TO postgres, service_role;
GRANT SELECT ON TABLE public.match_events TO authenticated, anon;

GRANT ALL ON TABLE public.player_rating_history TO postgres, service_role;
GRANT SELECT ON TABLE public.player_rating_history TO authenticated, anon;

GRANT ALL ON TABLE public.player_stats TO postgres, service_role;
GRANT SELECT ON TABLE public.player_stats TO authenticated, anon;

GRANT ALL ON TABLE public.fixtures TO postgres, service_role;
GRANT SELECT ON TABLE public.fixtures TO authenticated, anon;

GRANT ALL ON TABLE public.fixture_lineups TO postgres, service_role;
GRANT SELECT ON TABLE public.fixture_lineups TO authenticated, anon;

GRANT ALL ON TABLE public.player_votes TO postgres, service_role;
GRANT SELECT ON TABLE public.player_votes TO authenticated, anon;

GRANT ALL ON TABLE public.players TO postgres, service_role;
GRANT SELECT ON TABLE public.players TO authenticated, anon;

-- Player Votes Table
CREATE TABLE IF NOT EXISTS public.player_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(fixture_id, player_id, user_id)
);

-- Add location columns to clubs table
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS radius_meters INTEGER DEFAULT 100;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS pitch_name TEXT;

-- Enable RLS
ALTER TABLE public.player_votes ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_votes' AND policyname = 'Users can view all votes') THEN
        CREATE POLICY "Users can view all votes" ON public.player_votes FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_votes' AND policyname = 'Users can manage their own votes') THEN
        CREATE POLICY "Users can manage their own votes" ON public.player_votes FOR ALL TO authenticated USING (auth.uid() = user_id);
    END IF;
END $$;

-- submit_player_vote RPC is now defined in match_checkins.sql with support for GPS bypass and team restrictions.
-- Map existing positions to simplified ones
UPDATE public.players
SET position = CASE
    WHEN position IN ('GK', 'TW') THEN 'Torwart'
    WHEN position IN ('CB', 'LB', 'RB', 'LWB', 'RWB', 'IV', 'LV', 'RV') THEN 'Abwehr'
    WHEN position IN ('CDM', 'CM', 'CAM', 'LM', 'RM', 'ZDM', 'ZM', 'ZOM') THEN 'Mittelfeld'
    WHEN position IN ('LW', 'RW', 'CF', 'ST', 'LF', 'RF', 'MS', 'STU') THEN 'Sturm'
    ELSE position
END;
