-- Add sponsoring fields to fixtures table
ALTER TABLE public.fixtures 
ADD COLUMN IF NOT EXISTS match_sponsor_name TEXT,
ADD COLUMN IF NOT EXISTS match_sponsor_logo_url TEXT,
ADD COLUMN IF NOT EXISTS mvp_sponsor_name TEXT,
ADD COLUMN IF NOT EXISTS mvp_sponsor_logo_url TEXT;
