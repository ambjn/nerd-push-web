-- Supabase A (app source). Firebase UID is the canonical user key.
-- Apply with: supabase db push (linked to the A project) or psql -f.

create table public.app_user (
  firebase_uid text primary key check (length(firebase_uid) between 1 and 128),
  display_name text,
  timezone     text not null default 'UTC',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- IANA zone validity is enforced by trigger (pg_timezone_names is not usable in a CHECK).

create or replace function public.app_user_validate_timezone() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'invalid timezone %', new.timezone using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger app_user_validate_timezone
  before insert or update on public.app_user
  for each row execute function public.app_user_validate_timezone();

create table public.notification_preference (
  firebase_uid     text primary key references public.app_user(firebase_uid) on delete cascade,
  marketing_choice text check (marketing_choice in ('opted_in', 'opted_out')),
  updated_at       timestamptz not null default now()
);

-- No browser or device key may touch these tables. Only the registration
-- service (service role) and the SELECT-only reader (0003) have access.
alter table public.app_user enable row level security;
alter table public.notification_preference enable row level security;
revoke all on public.app_user, public.notification_preference from anon, authenticated;
