
ALTER TABLE public.player_rating_history ADD COLUMN IF NOT EXISTS neutral_votes_count INTEGER DEFAULT 0;
