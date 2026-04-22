-- Update match_events_event_type_check constraint to allow new event types
-- Run this in the Supabase SQL Editor

-- 1. Drop the existing constraints if they exist
ALTER TABLE public.match_events DROP CONSTRAINT IF EXISTS match_events_event_type_check;
ALTER TABLE public.match_events DROP CONSTRAINT IF EXISTS match_events_extra_minute_check;

-- 2. Add the updated event_type constraint
ALTER TABLE public.match_events ADD CONSTRAINT match_events_event_type_check 
CHECK (event_type IN (
    'starting_xi', 
    'sub_in', 
    'sub_out', 
    'goal', 
    'assist', 
    'yellow_card', 
    'red_card', 
    'clean_sheet', 
    'penalty_saved', 
    'penalty_missed'
));

-- 3. Add a more flexible extra_minute constraint (must be 0 or positive)
ALTER TABLE public.match_events ADD CONSTRAINT match_events_extra_minute_check 
CHECK (extra_minute >= 0);

-- 3. Verify the change
COMMENT ON CONSTRAINT match_events_event_type_check ON public.match_events IS 'Restricts match events to valid types including goals and assists.';
