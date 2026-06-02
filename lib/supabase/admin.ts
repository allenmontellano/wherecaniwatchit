import { createClient } from '@supabase/supabase-js'

// Bypasses RLS. ONLY call from server-side code (API routes, cron jobs).
// Never import this into client components or expose SUPABASE_SERVICE_ROLE_KEY to the browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
