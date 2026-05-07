-- Add assists column to player_rating_history
ALTER TABLE public.player_rating_history
ADD COLUMN IF NOT EXISTS assists integer DEFAULT 0;
