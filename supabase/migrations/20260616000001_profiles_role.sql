-- SP6: add a role to profiles for invite-only RBAC.
create type user_role as enum ('contributor', 'reviewer', 'admin');

alter table profiles
  add column role user_role not null default 'contributor';

-- Block a role change made by a PostgREST *client* (a user's own JWT). The
-- service-role admin client and trusted direct-DB connections (psql / dashboard /
-- Management API, which have no JWT client role) remain allowed. Fires on UPDATE
-- only, so the accept-invite INSERT that sets the initial role is unaffected.
create or replace function prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
declare
  jwt_role text := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
begin
  if new.role is distinct from old.role
     and jwt_role in ('anon', 'authenticated') then
    raise exception 'role cannot be changed by a client; use the service role';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on profiles
  for each row execute function prevent_role_self_escalation();
