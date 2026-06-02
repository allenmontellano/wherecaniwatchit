INSERT INTO regions (country_code, country_name, display_order) VALUES
  ('PH', 'Philippines',    1),
  ('US', 'United States',  2),
  ('GB', 'United Kingdom', 3),
  ('AU', 'Australia',      4),
  ('CA', 'Canada',         5)
ON CONFLICT (country_code) DO NOTHING;

-- slugs match the service IDs returned by the Streaming Availability API
INSERT INTO platforms (name, slug, supported_regions) VALUES
  ('Netflix',            'netflix',    ARRAY['PH','US','GB','AU','CA']),
  ('Disney+',            'disney',     ARRAY['PH','US','GB','AU','CA']),
  ('Amazon Prime Video', 'prime',      ARRAY['US','GB','AU','CA']),
  ('HBO Max',            'hbo',        ARRAY['US','PH']),
  ('Apple TV+',          'apple',      ARRAY['US','GB','AU','CA']),
  ('Hulu',               'hulu',       ARRAY['US']),
  ('Paramount+',         'paramount',  ARRAY['US','GB','AU','CA']),
  ('Peacock',            'peacock',    ARRAY['US']),
  ('Max',                'max',        ARRAY['US']),
  ('Mubi',               'mubi',       ARRAY['US','GB','AU','CA'])
ON CONFLICT (slug) DO NOTHING;
