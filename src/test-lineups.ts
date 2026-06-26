import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://upvzomofjjwaxkfogpuc.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwdnpvbW9mamp3YXhrZm9ncHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzgwMjksImV4cCI6MjA4OTQxNDAyOX0.xCHxlFl5q7YhH_5rF_D1CaRIkZhmzebYAvnxrl8j4Qk');

async function test() {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, club_id')
    .in('id', ['7217d5cf-9446-4eda-bbd1-5ccb23de2894', 'f83d42d5-fa6e-49bc-9dcf-fe5fe1883ad6']);
    
  console.log('Result:', data);
}
test();
