CREATE TABLE IF NOT EXISTS public.push_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  fixture_id uuid REFERENCES public.fixtures(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  title text,
  body text,
  platform text,
  token_start text,
  success boolean DEFAULT false,
  provider_status text,
  provider_response jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, fixture_id, notification_type) -- to prevent duplicates
);

ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;

-- Allow inserts via service role, allow users to read only their own logs if needed.
CREATE POLICY "Users can read own push logs"
  ON public.push_notification_log FOR SELECT
  USING (auth.uid() = user_id);
