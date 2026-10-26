create extension if not exists pgcrypto with schema extensions;

create table public.push_device (
  id                    uuid primary key default gen_random_uuid(),
  firebase_uid          text not null references public.app_user(firebase_uid) on delete cascade,
  installation_id       text not null check (length(installation_id) between 8 and 128),
  platform              text not null check (platform in ('android', 'ios')),
  provider              text not null check (provider in ('fcm', 'apns')),
  token                 text not null check (length(token) between 16 and 4096),  -- sensitive: never leaves A
  token_sha256          char(64) not null,
  app_id                text not null,
  environment           text not null default 'staging' check (environment = 'staging'),
  notifications_enabled boolean,
  registered_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  revoked_at            timestamptz,
  unique (platform, app_id, environment, installation_id)
);
create index push_device_uid_revoked_idx on public.push_device (firebase_uid, revoked_at);
-- One active token belongs to at most one installation/user.
create unique index push_device_active_token_idx on public.push_device (token_sha256) where revoked_at is null;

alter table public.push_device enable row level security;
revoke all on public.push_device from anon, authenticated;

-- Registration upsert used by the app-owned service (service role only).
-- Rotates the token in place, rebinds the installation on account switch,
-- and revokes any other active row that still holds this token.
create or replace function public.register_push_device(
  p_firebase_uid text, p_installation_id text, p_token text, p_platform text,
  p_app_id text, p_notifications_enabled boolean, p_display_name text, p_timezone text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash char(64) := encode(digest(p_token, 'sha256'), 'hex');
  v_id uuid;
begin
  insert into app_user (firebase_uid, display_name, timezone)
    values (p_firebase_uid, p_display_name, coalesce(p_timezone, 'UTC'))
    on conflict (firebase_uid) do update
      set display_name = coalesce(excluded.display_name, app_user.display_name),
          timezone = excluded.timezone;

  -- token moved to another installation: retire the old holder
  update push_device set revoked_at = now()
   where token_sha256 = v_hash and revoked_at is null
     and not (platform = p_platform and app_id = p_app_id and environment = 'staging' and installation_id = p_installation_id);

  insert into push_device (firebase_uid, installation_id, platform, provider, token, token_sha256, app_id, notifications_enabled)
    values (p_firebase_uid, p_installation_id, p_platform, case p_platform when 'ios' then 'apns' else 'fcm' end,
            p_token, v_hash, p_app_id, p_notifications_enabled)
    on conflict (platform, app_id, environment, installation_id) do update
      set firebase_uid = excluded.firebase_uid,
          token = excluded.token,
          token_sha256 = excluded.token_sha256,
          notifications_enabled = excluded.notifications_enabled,
          last_seen_at = now(),
          revoked_at = null
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.revoke_push_device(p_firebase_uid text, p_installation_id text, p_platform text, p_app_id text)
returns boolean language sql security definer set search_path = public as $$
  update push_device set revoked_at = now()
   where firebase_uid = p_firebase_uid and installation_id = p_installation_id
     and platform = p_platform and app_id = p_app_id and environment = 'staging' and revoked_at is null
  returning true;
$$;

revoke all on function public.register_push_device(text,text,text,text,text,boolean,text,text) from public, anon, authenticated;
revoke all on function public.revoke_push_device(text,text,text,text) from public, anon, authenticated;
