-- Add checker tracking fields to availability
ALTER TABLE availability
  ADD COLUMN watch_url TEXT,
  ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;

-- New platforms for Task 13 checker coverage
INSERT INTO platforms (name, slug, supported_regions) VALUES
  -- PH-specific
  ('Vivamax',     'vivamax',     ARRAY['PH']),
  ('iWantTFC',    'iwanttfc',    ARRAY['PH']),
  ('Viu',         'viu',         ARRAY['PH']),
  ('WeTV',        'wetv',        ARRAY['PH']),
  -- UK-specific
  ('ITVX',        'itvx',        ARRAY['GB']),
  ('Now TV',      'nowtv',       ARRAY['GB']),
  ('BBC iPlayer', 'bbc-iplayer', ARRAY['GB']),
  -- AU-specific
  ('Stan',        'stan',        ARRAY['AU']),
  ('Binge',       'binge',       ARRAY['AU']),
  -- CA-specific
  ('Crave',       'crave',       ARRAY['CA']),
  ('CBC Gem',     'cbc-gem',     ARRAY['CA']),
  -- Global
  ('Crunchyroll', 'crunchyroll', ARRAY['PH','US','GB','AU','CA']),
  ('Viki',        'viki',        ARRAY['PH','US','GB','AU','CA'])
ON CONFLICT (slug) DO NOTHING;
