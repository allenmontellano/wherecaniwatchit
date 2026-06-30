-- SP8: structured report fields, replacing the packed notes platform string.
alter table flags
  add column if not exists reported_platform text,
  add column if not exists reported_watch_url text;
