-- Creative drafts, immutable approved versions, and the staff test-send ledger (NERDPLAN-BASIC.md steps 2 and 4).
alter table public.push_device add column marketing_choice text check (marketing_choice in ('opted_in', 'opted_out'));

create table public.push_creative (
  id                uuid primary key default gen_random_uuid(),
  label             text not null check (length(label) between 1 and 120),
  title             text not null check (octet_length(title) between 1 and 120),
  body              text not null check (octet_length(body) between 1 and 500),
  message_class     text not null default 'transactional' check (message_class in ('transactional', 'marketing')),
  notification_type text not null check (notification_type in ('nerdpush_transactional', 'nerdpush_marketing')),
  route             text not null check (route in ('home', 'schedule', 'messages', 'account', 'study_plan')),
  web_url           text check (web_url is null or (web_url ~ '^https://' and length(web_url) <= 512)),
  status            text not null default 'draft' check (status in ('draft', 'approved')),
  row_version       bigint not null default 1,
  created_by        uuid not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.push_creative_version (
  id                uuid primary key default gen_random_uuid(),
  creative_id       uuid not null references public.push_creative(id),
  version           integer not null check (version > 0),
  title             text not null,
  body              text not null,
  message_class     text not null,
  notification_type text not null,
  route             text not null,
  web_url           text,
  artifact_sha256   char(64) not null,
  approved_by       uuid not null,
  approved_at       timestamptz not null default now(),
  unique (creative_id, version)
);

create or replace function public.deny_change() returns trigger language plpgsql as $$
begin raise exception '% is immutable', tg_table_name using errcode = '42501'; end $$;
create trigger push_creative_version_immutable before update or delete on public.push_creative_version for each row execute function public.deny_change();

-- Drafts only; row_version advances on every update.
create or replace function public.push_creative_guard() returns trigger language plpgsql as $$
begin
  if old.status <> 'draft' then raise exception 'creative_not_draft' using errcode = '42501'; end if;
  new.row_version := old.row_version + 1;
  new.updated_at := now();
  return new;
end $$;
create trigger push_creative_guard before update on public.push_creative for each row execute function public.push_creative_guard();

-- Approval: compare-and-swap on row_version, freeze a version with the server-computed fingerprint.
create or replace function public.approve_push_creative(p_id uuid, p_actor uuid, p_row_version bigint, p_sha256 char(64)) returns uuid
language plpgsql security definer set search_path = public as $$
declare c public.push_creative; v uuid;
begin
  select * into c from public.push_creative where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if c.status <> 'draft' then raise exception 'not_draft' using errcode = '42501'; end if;
  if c.row_version <> p_row_version then raise exception 'stale_row_version' using errcode = '40001'; end if;
  insert into public.push_creative_version (creative_id, version, title, body, message_class, notification_type, route, web_url, artifact_sha256, approved_by)
    select p_id, coalesce(max(version), 0) + 1, c.title, c.body, c.message_class, c.notification_type, c.route, c.web_url, p_sha256, p_actor
    from public.push_creative_version where creative_id = p_id returning id into v;
  update public.push_creative set status = 'approved' where id = p_id;
  return v;
end $$;

create table public.push_test_send (
  id                  uuid primary key,
  actor               uuid not null,
  firebase_uid        text not null,
  creative_version_id uuid not null references public.push_creative_version(id),
  title               text not null check (title like '[TEST] %'),
  provider            text not null check (provider in ('mock', 'fcm')),
  status              text not null check (status in ('accepted', 'skipped', 'failed', 'delivery_unknown')),
  error_code          text check (length(error_code) <= 64),
  device_outcomes     jsonb not null default '[]'::jsonb,   -- token sha256 only, never a raw token
  created_at          timestamptz not null default now()
);
create index push_test_send_uid_idx on public.push_test_send (firebase_uid, created_at);

alter table public.push_creative enable row level security;
alter table public.push_creative_version enable row level security;
alter table public.push_test_send enable row level security;
revoke all on public.push_creative, public.push_creative_version, public.push_test_send from anon, authenticated;
revoke all on function public.approve_push_creative(uuid, uuid, bigint, char) from public, anon, authenticated;
