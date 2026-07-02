import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE URL or service role key in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log("=== Checking RLS and Policies ===");

  // We can select policies from pg_policies using service_role
  const { data: policies, error: pError } = await supabase
    .from('pg_policies')
    .select('*')
    .or('schemaname.eq.public');

  if (pError) {
    // If pg_policies is not accessible via PostgREST, we can query it via standard direct client or we can try another approach.
    // Let's see if we can query pg_policies as it's a system table
    console.log("Could not query pg_policies directly:", pError.message);
  } else {
    console.log("Policies in public schema:");
    console.log(policies);
  }

  // Let's check RLS status of tables by selecting from a view or custom join if possible.
  // Generally we can look at pg_class in system catalogs if exposed, but PostgREST doesn't expose pg_class by default.
  // Let's fetch some counts from different tables with public client vs service role client.
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const anonSupabase = createClient(supabaseUrl, anonKey);

  const tables = ['profiles', 'players', 'fixtures', 'clubs', 'teams', 'leagues', 'player_stats'];
  
  console.log("\n=== Comparing Service Role vs Anon Key Rows ===");
  for (const table of tables) {
    const { count: sCount, error: sErr } = await supabase.from(table).select('*', { count: 'exact', head: true });
    const { count: aCount, error: aErr } = await anonSupabase.from(table).select('*', { count: 'exact', head: true });
    
    console.log(`Table '${table}':`);
    console.log(`  Service Role: count = ${sCount}, error = ${sErr ? sErr.message : 'none'}`);
    console.log(`  Anon Client : count = ${aCount}, error = ${aErr ? aErr.message : 'none'}`);
  }
}

run();
