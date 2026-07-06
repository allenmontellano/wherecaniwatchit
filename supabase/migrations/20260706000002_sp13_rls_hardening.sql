-- SP13 / SEC-01: stop the public anon key from reading the whole user roster,
-- and hide internal review metadata on the public catalog table.
-- Additive to RLS only; the app reads these tables via the service-role client,
-- which BYPASSES RLS + column grants and is therefore unaffected. Idempotent.

-- 1) profiles: replace blanket public read with self-read + staff (reviewer/admin) read.
drop policy if exists "profiles_public_read" on profiles;

drop policy if exists "profiles_self_read" on profiles;
create policy "profiles_self_read" on profiles
  for select using (auth.uid() = user_id);

-- Reviewers/admins may read all profiles (role taken from the verified JWT claim,
-- app_metadata.role — which only the service role can set). Defense-in-depth so a
-- future user-scoped CMS read still works without re-opening public access.
drop policy if exists "profiles_staff_read" on profiles;
create policy "profiles_staff_read" on profiles
  for select using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('reviewer', 'admin')
  );

-- 2) availability: keep rows publicly readable (public catalog) but drop the
-- sensitive columns from anon/authenticated column access. SEC-01 fold-in:
-- reviewed_by / reviewed_at (internal reviewer identity) and confidence
-- (internal trust signal) are no longer exposed to direct PostgREST scraping.
revoke select on availability from anon;
revoke select on availability from authenticated;
grant select (
  id, title_id, platform_id, region_code, available,
  last_verified, source, watch_url, consecutive_failures,
  created_at, updated_at
) on availability to anon;
grant select (
  id, title_id, platform_id, region_code, available,
  last_verified, source, watch_url, consecutive_failures,
  created_at, updated_at
) on availability to authenticated;
