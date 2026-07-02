import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data, error } = await supabase
    .from('players')
    .select('id, full_name, claimed_by_user_id')
    .not('claimed_by_user_id', 'is', null);

  console.log("Claimed players in database:", { count: data?.length, data, error });
}

run();
