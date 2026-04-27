-- Migration to include neutral votes in PLYRZ app
-- Author: AI Coding Agent
-- Date: 2024-04-26

-- 1. Update player_votes table to allow 'neutral' vote type
-- We assume the table is named player_votes and has a vote column
ALTER TABLE player_votes DROP CONSTRAINT IF EXISTS player_votes_vote_check;
ALTER TABLE player_votes ADD CONSTRAINT player_votes_vote_check CHECK (vote IN ('up', 'down', 'neutral'));

-- 2. Update player_rating_history to include neutral vote counting columns
ALTER TABLE player_rating_history 
ADD COLUMN IF NOT EXISTS votes_neutral INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS neutral_votes INTEGER DEFAULT 0;

-- 3. Comment explaining the change
COMMENT ON COLUMN player_votes.vote IS 'The type of vote: up (positive), down (negative), or neutral (no impact on rating).';
COMMENT ON COLUMN player_rating_history.neutral_votes IS 'Count of neutral votes received by the player in this fixture.';
