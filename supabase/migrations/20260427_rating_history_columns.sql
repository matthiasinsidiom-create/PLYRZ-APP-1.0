-- Ensure all required columns for Rating 3.0 processing exist in player_rating_history
ALTER TABLE public.player_rating_history 
ADD COLUMN IF NOT EXISTS is_mvp BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mvp_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS mvp_bonus NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS vote_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS positive_votes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS negative_votes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS neutral_votes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS votes_up INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS votes_down INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS vote_impact NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS result_impact NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS event_impact NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS goal_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS yellow_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS red_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS participation_multiplier NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS expected_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS raw_delta NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS final_delta NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_version TEXT DEFAULT '3.0';

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_player_rating_history_fixture_id ON public.player_rating_history(fixture_id);
CREATE INDEX IF NOT EXISTS idx_player_rating_history_player_id ON public.player_rating_history(player_id);
CREATE INDEX IF NOT EXISTS idx_player_rating_history_is_mvp ON public.player_rating_history(is_mvp) WHERE is_mvp = true;
