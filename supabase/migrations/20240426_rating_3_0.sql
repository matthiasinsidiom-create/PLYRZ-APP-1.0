-- Migration to Rating 3.0
-- Add missing columns to player_rating_history

ALTER TABLE player_rating_history 
ADD COLUMN IF NOT EXISTS is_mvp BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mvp_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS vote_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS positive_votes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS negative_votes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS raw_delta NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS final_delta NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS mvp_bonus NUMERIC DEFAULT 0;

-- Optional: Ensure index for performance on MVP lookups
CREATE INDEX IF NOT EXISTS idx_player_rating_history_is_mvp ON player_rating_history(is_mvp) WHERE is_mvp = true;
