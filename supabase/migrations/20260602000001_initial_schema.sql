-- Supported launch regions
CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) UNIQUE NOT NULL,
  country_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 999,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Streaming platforms
CREATE TABLE platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  supported_regions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Title metadata sourced from TMDB
CREATE TABLE titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id INTEGER UNIQUE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('movie', 'tv')),
  genres TEXT[] NOT NULL DEFAULT '{}',
  runtime INTEGER,
  release_year INTEGER,
  synopsis TEXT,
  poster_url TEXT,
  imdb_rating DECIMAL(3,1),
  imdb_id TEXT,
  season_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Streaming availability per title / platform / region
CREATE TABLE availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  region_code CHAR(2) NOT NULL,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  last_verified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'api',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(title_id, platform_id, region_code)
);

CREATE INDEX idx_availability_title ON availability(title_id);
CREATE INDEX idx_availability_title_region ON availability(title_id, region_code);

-- User profiles — extends auth.users (Phase 2 auth; schema created now)
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  region_code CHAR(2),
  contribution_count INTEGER NOT NULL DEFAULT 0,
  reputation_score INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crowdsourced availability corrections
CREATE TABLE flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  availability_id UUID NOT NULL REFERENCES availability(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('incorrect', 'outdated', 'missing')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_hash TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on titles, availability, and flags
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER titles_updated_at
  BEFORE UPDATE ON titles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER availability_updated_at
  BEFORE UPDATE ON availability FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER flags_updated_at
  BEFORE UPDATE ON flags FOR EACH ROW EXECUTE FUNCTION update_updated_at();
