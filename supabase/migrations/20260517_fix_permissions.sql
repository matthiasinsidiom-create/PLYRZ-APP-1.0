-- Grant permissions to club_admins table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_admins TO authenticated;
GRANT SELECT ON public.club_admins TO anon;
GRANT ALL ON public.club_admins TO service_role;

-- Ensure clubs table is accessible (it should be, but just in case for the join)
GRANT SELECT ON public.clubs TO authenticated;
GRANT SELECT ON public.clubs TO anon;

-- Ensure teams table is accessible (used in the function)
GRANT SELECT ON public.teams TO authenticated;
GRANT SELECT ON public.teams TO anon;

-- Add the current user as a club admin for the first club found to enable the Admin tab
INSERT INTO public.club_admins (user_id, club_id, team_scope, role)
SELECT id, (SELECT id FROM public.clubs LIMIT 1), 'all', 'club_manager'
FROM auth.users
WHERE email = 'matthias.insidiom@gmail.com'
ON CONFLICT (user_id, club_id, team_scope) DO NOTHING;
