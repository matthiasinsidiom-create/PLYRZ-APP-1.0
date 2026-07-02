import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !anonKey) {
  console.error("Missing SUPABASE URL or ANON KEY in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey);

async function checkTable(tableName: string) {
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  console.log(`Table '${tableName}':`, {
    success: !error,
    errorMsg: error ? error.message : null,
    errorCode: error ? error.code : null,
    rowCount: data?.length
  });
}

async function run() {
  const tables = [
    'profiles',
    'players',
    'fixtures',
    'clubs',
    'teams',
    'leagues',
    'match_checkins',
    'player_votes',
    'player_stats',
    'fixture_lineups',
    'match_events'
  ];

  console.log("=== Testing Anon Key Read Access ===");
  for (const table of tables) {
    await checkTable(table);
  }
}

run();
