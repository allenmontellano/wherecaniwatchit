-- Monthly API quota tracking for the Movie of the Night (MOTN) Pro plan (25,000 calls/month).
CREATE TABLE api_quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  calls_used INTEGER NOT NULL DEFAULT 0,
  calls_limit INTEGER NOT NULL DEFAULT 25000,
  month CHAR(7) NOT NULL,          -- 'YYYY-MM' (UTC)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service, month)
);

-- Seed-state marker for titles. NULL = not seeded via bulk pipeline,
-- 'active' = seeded OK, 'pending' = seed failed, retry when quota resets.
-- Note: titles.status already holds the TMDB production status (e.g. 'Released'),
-- so seed state needs its own column.
ALTER TABLE titles ADD COLUMN seed_status TEXT;

-- Atomic increment so concurrent MOTN calls can't lose updates.
-- Upserts the month row and returns the new running total.
CREATE OR REPLACE FUNCTION increment_quota(
  p_service TEXT,
  p_month CHAR(7),
  p_n INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 25000
)
RETURNS INTEGER AS $$
DECLARE
  new_used INTEGER;
BEGIN
  INSERT INTO api_quota (service, month, calls_used, calls_limit)
  VALUES (p_service, p_month, p_n, p_limit)
  ON CONFLICT (service, month)
  DO UPDATE SET
    calls_used = api_quota.calls_used + p_n,
    updated_at = NOW()
  RETURNING calls_used INTO new_used;

  RETURN new_used;
END;
$$ LANGUAGE plpgsql;
