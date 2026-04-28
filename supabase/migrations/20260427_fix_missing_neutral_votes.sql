
-- Targeted migration for the missing column
ALTER TABLE public.player_rating_history 
ADD COLUMN IF NOT EXISTS neutral_votes INTEGER DEFAULT 0;

-- Another force reload attempt
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS _dummy_col_reload BOOLEAN DEFAULT FALSE;
ALTER TABLE public.fixtures DROP COLUMN IF NOT EXISTS _dummy_col_reload;
