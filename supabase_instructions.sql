-- Führe dieses SQL-Skript im Supabase SQL Editor aus, um die fehlenden Spalten hinzuzufügen 
-- und den Schema Cache sofort zu aktualisieren.

ALTER TABLE public.player_rating_history ADD COLUMN IF NOT EXISTS neutral_votes INTEGER DEFAULT 0;
ALTER TABLE public.player_rating_history ADD COLUMN IF NOT EXISTS votes_neutral INTEGER DEFAULT 0;
ALTER TABLE public.player_rating_history ADD COLUMN IF NOT EXISTS neutral_votes_count INTEGER DEFAULT 0;

-- Dies ist der wichtigste Befehl, um den "Schema cache error" zu beheben:
NOTIFY pgrst, 'reload schema';
