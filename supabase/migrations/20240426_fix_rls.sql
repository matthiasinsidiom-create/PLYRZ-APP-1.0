-- Enable RLS on player_rating_history if not already enabled
ALTER TABLE player_rating_history ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read rating history
DROP POLICY IF EXISTS "Public can read rating history" ON player_rating_history;
CREATE POLICY "Public can read rating history" 
ON player_rating_history FOR SELECT 
USING (true);

-- Ensure authenticated users can also read (redundant but safe)
DROP POLICY IF EXISTS "Authenticated users can read rating history" ON player_rating_history;
CREATE POLICY "Authenticated users can read rating history" 
ON player_rating_history FOR SELECT 
TO authenticated 
USING (true);
