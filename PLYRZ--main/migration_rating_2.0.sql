-- Migration for Rating 2.0 Event Impact
ALTER TABLE public.player_rating_history ADD COLUMN IF NOT EXISTS goal_count INTEGER DEFAULT 0;
ALTER TABLE public.player_rating_history ADD COLUMN IF NOT EXISTS yellow_count INTEGER DEFAULT 0;
ALTER TABLE public.player_rating_history ADD COLUMN IF NOT EXISTS red_count INTEGER DEFAULT 0;
ALTER TABLE public.player_rating_history ADD COLUMN IF NOT EXISTS event_impact NUMERIC DEFAULT 0;

-- Ensure simplified positions are used
UPDATE public.players
SET position = CASE
    WHEN position IN ('GK', 'TW', 'Torwart') THEN 'Torwart'
    WHEN position IN ('CB', 'LB', 'RB', 'LWB', 'RWB', 'IV', 'LV', 'RV', 'Abwehr') THEN 'Abwehr'
    WHEN position IN ('CDM', 'CM', 'CAM', 'LM', 'RM', 'ZDM', 'ZM', 'ZOM', 'Mittelfeld') THEN 'Mittelfeld'
    WHEN position IN ('LW', 'RW', 'CF', 'ST', 'LF', 'RF', 'MS', 'STU', 'Sturm') THEN 'Sturm'
    ELSE position
END;
