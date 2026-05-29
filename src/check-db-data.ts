import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: leagues, error: lErr } = await supabase.from('leagues').select('*');
  console.log("Leagues:", { leagues, error: lErr });

  const { data: fixtures, error: fErr } = await supabase.from('fixtures').select('id, league_id').limit(10);
  console.log("Fixtures:", { fixtures, error: fErr });

  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').limit(5);
  console.log("Profiles:", { profiles, error: pErr });
}

run();
