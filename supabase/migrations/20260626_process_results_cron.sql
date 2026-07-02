-- Enable the pg_net extension for HTTP requests if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Note: pg_cron is usually enabled by default on Supabase, but requires being on the postgres database.
-- Supabase Cloud enables it automatically. 

-- Unschedule if it already exists to avoid duplicates
SELECT cron.unschedule('process-fixture-results-cron');

-- Schedule the match processor edge function to run every 5 minutes
-- We use the anon key from the project config to authorize the request
SELECT cron.schedule(
  'process-fixture-results-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
      url:='https://upvzomofjjwaxkfogpuc.supabase.co/functions/v1/match-processor',
      headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwdnpvbW9mamp3YXhrZm9ncHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzgwMjksImV4cCI6MjA4OTQxNDAyOX0.xCHxlFl5q7YhH_5rF_D1CaRIkZhmzebYAvnxrl8j4Qk'
      ),
      body:=jsonb_build_object('type', 'cron')
  );
  $$
);
