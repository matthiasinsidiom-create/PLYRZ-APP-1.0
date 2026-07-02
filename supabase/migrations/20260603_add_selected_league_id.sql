-- Add selected_league_id to profiles if it doesn't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS selected_league_id uuid REFERENCES public.leagues(id) ON DELETE SET NULL;
