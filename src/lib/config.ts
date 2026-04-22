export const GPS_VOTING_REQUIRED = false; // Set to true in production

export const appConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'https://upvzomofjjwaxkfogpuc.supabase.co',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwdnpvbW9mamp3YXhrZm9ncHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzgwMjksImV4cCI6MjA4OTQxNDAyOX0.xCHxlFl5q7YhH_5rF_D1CaRIkZhmzebYAvnxrl8j4Qk',
  // Feature Flag: Set to false to disable GPS check-in requirement for development/testing
  GPS_VOTING_REQUIRED: GPS_VOTING_REQUIRED,
};
