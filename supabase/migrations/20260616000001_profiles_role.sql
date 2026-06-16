-- SP6: add a role to profiles for invite-only RBAC.
do $$ begin
  create type user_role as enum ('contributor', 'reviewer', 'admin');
exception when duplicate_object then null;
end $$;

alter table profiles
  add column if not exists role user_role not null default 'contributor';

-- Block a role change made by a PostgREST *client* (a user's own JWT). The
-- service-role admin client and trusted direct-DB connections (psql / dashboard /
-- Management API, which have no JWT client role) remain allowed. Fires on UPDATE
-- only, so the accept-invite INSERT that sets the initial role is unaffected.
create or replace function prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
declare
  raw_claims text := current_setting('request.jwt.claims', true);
  jwt_role text := case
    when raw_claims is null or raw_claims = '' then null
    else (raw_claims::jsonb) ->> 'role'
  end;
begin
  if new.role is distinct from old.role
     and jwt_role in ('anon', 'authenticated') then
    raise exception 'role cannot be changed by a client; use the service role';
  end if;
  return new;
end;
$$;

create or replace trigger profiles_prevent_role_escalation
  before update on profiles
  for each row execute function prevent_role_self_escalation();
