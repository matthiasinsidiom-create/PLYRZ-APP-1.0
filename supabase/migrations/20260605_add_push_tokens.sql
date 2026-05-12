CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Enable RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own push tokens" 
ON public.push_tokens
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own push tokens" 
ON public.push_tokens
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens" 
ON public.push_tokens
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens" 
ON public.push_tokens
FOR DELETE 
USING (auth.uid() = user_id);

-- Service role has full access by default, but we can explicitly add a policy if needed
CREATE POLICY "Service Role can manage all push tokens"
ON public.push_tokens
FOR ALL
USING (auth.uid() IS NULL); -- Roughly for service_role, though often just rely on postgres/service_role roles bypassing RLS
