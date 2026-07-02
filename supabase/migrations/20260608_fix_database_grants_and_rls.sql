-- ====================================================================
-- MIGRATION: Fix Table Grants and RLS Policies for Public Access
-- ====================================================================
-- Description: Grants standard read permits to 'anon' and 'authenticated'
-- roles across public tables to prevent Postgres 42501 (permission denied)
-- errors and empty results for players, matches, and team lists.
-- ====================================================================

-- 1. DATABASE GRANTS
-- Ensure 'anon' (unauthenticated guests) and 'authenticated' (logged-in users)
-- have explicit Postgres permissions to view the sports data.

GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

GRANT SELECT ON public.leagues TO anon, authenticated;
GRANT SELECT ON public.clubs TO anon, authenticated;
GRANT SELECT ON public.teams TO anon, authenticated;
GRANT SELECT ON public.players TO anon, authenticated;
GRANT SELECT ON public.fixtures TO anon, authenticated;
GRANT SELECT ON public.player_stats TO anon, authenticated;
GRANT SELECT ON public.match_events TO anon, authenticated;
GRANT SELECT ON public.fixture_lineups TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_checkins TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_votes TO anon, authenticated;

-- Grant standard usage on public schemas/sequences for auto-incrementing fields
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 2. ENABLE ROW LEVEL SECURITY AND CONFIGURE PERMISSIVE POLICIES
-- This ensures that RLS does not silently block SELECT reads for standard users.

-- Profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on profiles" ON public.profiles;
CREATE POLICY "Allow public read on profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
CREATE POLICY "Allow users to update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow users to insert own profile" ON public.profiles;
CREATE POLICY "Allow users to insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Leagues table
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on leagues" ON public.leagues;
CREATE POLICY "Allow public read on leagues" ON public.leagues FOR SELECT USING (true);

-- Clubs table
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on clubs" ON public.clubs;
CREATE POLICY "Allow public read on clubs" ON public.clubs FOR SELECT USING (true);

-- Teams table
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on teams" ON public.teams;
CREATE POLICY "Allow public read on teams" ON public.teams FOR SELECT USING (true);

-- Players table
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on players" ON public.players;
CREATE POLICY "Allow public read on players" ON public.players FOR SELECT USING (true);

-- Player Stats table
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on player_stats" ON public.player_stats;
CREATE POLICY "Allow public read on player_stats" ON public.player_stats FOR SELECT USING (true);

-- Fixtures table
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on fixtures" ON public.fixtures;
CREATE POLICY "Allow public read on fixtures" ON public.fixtures FOR SELECT USING (true);

-- Match Events table
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on match_events" ON public.match_events;
CREATE POLICY "Allow public read on match_events" ON public.match_events FOR SELECT USING (true);

-- Fixture Lineups table
ALTER TABLE public.fixture_lineups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on fixture_lineups" ON public.fixture_lineups;
CREATE POLICY "Allow public read on fixture_lineups" ON public.fixture_lineups FOR SELECT USING (true);

-- Match Checkins table (Public select, personal manage)
ALTER TABLE public.match_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on match_checkins" ON public.match_checkins;
CREATE POLICY "Allow public read on match_checkins" ON public.match_checkins FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow users to insert own match_checkins" ON public.match_checkins;
CREATE POLICY "Allow users to insert own match_checkins" ON public.match_checkins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to delete own match_checkins" ON public.match_checkins;
CREATE POLICY "Allow users to delete own match_checkins" ON public.match_checkins FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Player Votes table (Public select, personal manage)
ALTER TABLE public.player_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on player_votes" ON public.player_votes;
CREATE POLICY "Allow public read on player_votes" ON public.player_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow users to insert own player_votes" ON public.player_votes;
CREATE POLICY "Allow users to insert own player_votes" ON public.player_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to update own player_votes" ON public.player_votes;
CREATE POLICY "Allow users to update own player_votes" ON public.player_votes FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
