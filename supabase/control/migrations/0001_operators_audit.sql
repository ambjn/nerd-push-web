-- Supabase B (control). Schema np. After applying, add "np" to the API's exposed
-- schemas in the Supabase dashboard so the server-side service-role client can use it.
create schema if not exists np;
create extension if not exists pgcrypto with schema extensions;

create table np.operator (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('editor', 'sender', 'admin')),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table np.operator_audit (
  id         bigint generated always as identity primary key,
  actor      uuid,                      -- null for system/worker actions
  action     text not null check (length(action) <= 64),
  entity     text not null check (length(entity) <= 128),
  metadata   jsonb not null default '{}'::jsonb check (pg_column_size(metadata) <= 4096),
  created_at timestamptz not null default now()
);
create index operator_audit_entity_idx on np.operator_audit (entity, created_at);

-- Append-only: no UPDATE/DELETE ever.
create or replace function np.deny_change() returns trigger language plpgsql as $$
begin raise exception 'np.% is append-only', tg_table_name using errcode = '42501'; end $$;
create trigger operator_audit_append_only before update or delete on np.operator_audit
  for each row execute function np.deny_change();

-- Trusted bootstrap procedure. Run manually by the project owner in the SQL editor:
--   select np.bootstrap_operator('staff@example.com', 'admin');
-- The user must already exist in auth.users (invite or sign up first).
create or replace function np.bootstrap_operator(p_email text, p_role text) returns uuid
language plpgsql security definer set search_path = np, public as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;
  if v_id is null then raise exception 'no auth user with email %', p_email; end if;
  insert into np.operator (auth_user_id, role) values (v_id, p_role)
    on conflict (auth_user_id) do update set role = excluded.role, active = true, updated_at = now();
  insert into np.operator_audit (actor, action, entity, metadata)
    values (null, 'operator.bootstrap', 'operator:' || v_id, jsonb_build_object('role', p_role));
  return v_id;
end $$;

-- Nothing in np is reachable by anon/authenticated API keys; routes use the service role server-side.
revoke all on schema np from anon, authenticated;
revoke all on all tables in schema np from anon, authenticated;
alter default privileges in schema np revoke all on tables from anon, authenticated;
alter default privileges in schema np revoke all on functions from anon, authenticated;
grant usage on schema np to service_role;
grant all on all tables in schema np to service_role;
grant all on all sequences in schema np to service_role;
alter default privileges in schema np grant all on tables to service_role;
alter default privileges in schema np grant all on sequences to service_role;
alter default privileges in schema np grant execute on functions to service_role;
