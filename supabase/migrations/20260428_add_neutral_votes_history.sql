alter table public.player_rating_history
add column if not exists neutral_votes integer default 0;

notify pgrst, 'reload schema';
