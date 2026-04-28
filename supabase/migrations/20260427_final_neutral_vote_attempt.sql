
-- Cleanest possible attempt to add the missing column
ALTER TABLE public.player_rating_history ADD COLUMN neutral_votes INT DEFAULT 0;
