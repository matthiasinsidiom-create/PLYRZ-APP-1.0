-- Add Premium fields to players
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ NULL;

-- Create Premium Requests table
CREATE TABLE IF NOT EXISTS public.player_premium_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'done')),
    note TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for player_premium_requests
ALTER TABLE public.player_premium_requests ENABLE ROW LEVEL SECURITY;

-- Admins can read all requests
CREATE POLICY "Superadmins can view all premium requests"
ON public.player_premium_requests FOR SELECT
USING (auth.jwt() ->> 'email' = 'matthias.insidiom@gmail.com');

-- Superadmins can update requests
CREATE POLICY "Superadmins can update premium requests"
ON public.player_premium_requests FOR UPDATE
USING (auth.jwt() ->> 'email' = 'matthias.insidiom@gmail.com');

-- Users can read their own requests
CREATE POLICY "Users can view their own premium requests"
ON public.player_premium_requests FOR SELECT
USING (auth.uid() = user_id);

-- Users can create requests for themselves
CREATE POLICY "Users can create premium requests"
ON public.player_premium_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION trigger_set_updated_at_premium_requests()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_premium_requests
BEFORE UPDATE ON public.player_premium_requests
FOR EACH ROW
EXECUTE FUNCTION trigger_set_updated_at_premium_requests();
