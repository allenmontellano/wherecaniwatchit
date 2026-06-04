-- Allow reports that aren't tied to an existing availability row (e.g. "not available here"),
-- and capture the title + region + issue context directly. Additive + nullable — safe.
alter table flags alter column availability_id drop not null;
alter table flags
  add column if not exists title_id uuid references titles(id) on delete cascade,
  add column if not exists region_code text,
  add column if not exists issue_type text;
