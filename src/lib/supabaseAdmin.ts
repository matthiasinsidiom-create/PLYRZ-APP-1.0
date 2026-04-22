import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('DEBUG: [SUPABASE_ADMIN] Environment Check:');
console.log('  - VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'Present' : 'Missing');
console.log('  - SUPABASE_URL:', process.env.SUPABASE_URL ? 'Present' : 'Missing');
console.log('  - SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? `Present (Length: ${supabaseServiceRoleKey.length}, Starts with: ${supabaseServiceRoleKey.substring(0, 10)}...)` : 'Missing');
console.log('  - NODE_ENV:', process.env.NODE_ENV);

// CRITICAL: Check if service role key is actually the anon key
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
if (supabaseServiceRoleKey && supabaseServiceRoleKey === anonKey) {
  console.error('DEBUG: [SUPABASE_ADMIN] CRITICAL WARNING: SUPABASE_SERVICE_ROLE_KEY is identical to VITE_SUPABASE_ANON_KEY!');
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('DEBUG: [SUPABASE_ADMIN] CRITICAL ERROR: Missing URL or Service Role Key!');
}

export const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceRoleKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
);
