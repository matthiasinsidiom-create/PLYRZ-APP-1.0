import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: player, error } = await supabase
    .from('players')
    .select('id, full_name, team_id, teams(*)')
    .eq('id', '409bd65f-cc40-45c1-a6e2-fed682adfe3a')
    .single();

  console.log("Player Josef Flieger:", { player, error });

  if (player?.teams) {
    const team = player.teams as any;
    const { data: club, error: cErr } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', team.club_id)
      .single();
    console.log("Club of Josef Flieger:", { club, error: cErr });
  }
}

run();
