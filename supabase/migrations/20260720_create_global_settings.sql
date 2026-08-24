CREATE TABLE IF NOT EXISTS global_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read global settings" ON global_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage global settings" ON global_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Insert a default row for popup_news
INSERT INTO global_settings (key, value) 
VALUES ('popup_news', '{"active": false, "title": "", "message": "", "id": ""}')
ON CONFLICT (key) DO NOTHING;
