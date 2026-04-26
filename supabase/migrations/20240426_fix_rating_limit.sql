-- Migration to allow MVP bonus (+3.0)
-- Drop the existing constraint if it exists and recreate it with wider range

ALTER TABLE player_rating_history 
DROP CONSTRAINT IF EXISTS player_rating_history_delta_overall_check;

ALTER TABLE player_rating_history 
ADD CONSTRAINT player_rating_history_delta_overall_check 
CHECK (delta_overall >= -2.5 AND delta_overall <= 3.5);
