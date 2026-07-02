-- Allow club admins to create fallback opponent goals for the other team
DROP POLICY IF EXISTS "club_admins_manage_events" ON public.match_events;
CREATE POLICY "club_admins_manage_events" 
ON public.match_events 
FOR ALL 
TO authenticated
USING (
  public.can_manage_match_event(fixture_id, team_id) 
  OR (
    public.can_manage_fixture(fixture_id) 
    AND event_type = 'opponent_goal' 
    AND player_id IS NULL
    AND assist_player_id IS NULL
    AND related_player_id IS NULL
  )
)
WITH CHECK (
  public.can_manage_match_event(fixture_id, team_id) 
  OR (
    public.can_manage_fixture(fixture_id) 
    AND event_type = 'opponent_goal' 
    AND player_id IS NULL
    AND assist_player_id IS NULL
    AND related_player_id IS NULL
  )
);
