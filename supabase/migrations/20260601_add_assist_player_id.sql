-- Migration to add assist_player_id
ALTER TABLE public.match_events
ADD COLUMN IF NOT EXISTS assist_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL;
