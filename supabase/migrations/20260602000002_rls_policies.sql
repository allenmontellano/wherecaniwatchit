ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE flags ENABLE ROW LEVEL SECURITY;

-- Public reads (no auth required for discovery)
CREATE POLICY "regions_public_read" ON regions FOR SELECT USING (TRUE);
CREATE POLICY "platforms_public_read" ON platforms FOR SELECT USING (TRUE);
CREATE POLICY "titles_public_read" ON titles FOR SELECT USING (TRUE);
CREATE POLICY "availability_public_read" ON availability FOR SELECT USING (TRUE);
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT USING (TRUE);

-- No INSERT/UPDATE/DELETE policies for anon/auth on core tables.
-- All writes go through API routes using the service role, which bypasses RLS.

-- Flags: anyone can submit; only owner or service role can read
CREATE POLICY "flags_public_insert" ON flags FOR INSERT WITH CHECK (ip_hash IS NOT NULL);
CREATE POLICY "flags_owner_read" ON flags FOR SELECT USING (
  auth.uid() IS NOT NULL AND auth.uid() = user_id
);

-- Profiles: users manage only their own row
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
