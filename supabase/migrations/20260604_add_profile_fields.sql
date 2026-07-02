-- Add selected_league_id and favorite_club_id to profiles if they don't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS selected_league_id uuid REFERENCES public.leagues(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS favorite_club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL;
