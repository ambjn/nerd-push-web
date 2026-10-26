create table np.push_allowlist (
  firebase_uid text primary key check (length(firebase_uid) between 1 and 128),
  enabled      boolean not null default true,
  reason       text not null check (length(reason) between 1 and 200),
  added_by     uuid not null,
  added_at     timestamptz not null default now()
);
-- No wildcard rows in v1.
alter table np.push_allowlist add constraint push_allowlist_no_wildcard check (firebase_uid !~ '[*%]');

create table np.push_policy (
  singleton         boolean primary key default true check (singleton),
  max_24h           integer not null default 1 check (max_24h >= 0),
  max_7d            integer not null default 3 check (max_7d >= 0),
  window_start_hour integer not null default 8 check (window_start_hour between 0 and 23),
  window_end_hour   integer not null default 22 check (window_end_hour between 1 and 24)
);
insert into np.push_policy default values;

create table np.push_send (
  id                    uuid primary key default gen_random_uuid(),
  firebase_uid          text not null check (length(firebase_uid) between 1 and 128),
  creative_version_id   uuid not null references np.push_creative_version(id),
  idempotency_key       text not null unique check (length(idempotency_key) between 8 and 128),
  status                text not null default 'pending' check (status in ('pending', 'sending', 'accepted', 'skipped', 'failed', 'delivery_unknown')),
  scheduled_at          timestamptz not null default now(),
  next_attempt_at       timestamptz not null default now(),
  rendered_snapshot     jsonb,
  claim_owner           text,
  claimed_at            timestamptz,
  reserved_at           timestamptz,             -- counts against caps once set
  provider_attempted_at timestamptz,
  provider_accepted_at  timestamptz,
  error_code            text check (length(error_code) <= 64),
  retry_count           integer not null default 0,
  requested_by          uuid not null,
  requested_at          timestamptz not null default now(),
  finished_at           timestamptz
);
create index push_send_due_idx on np.push_send (status, next_attempt_at, id);
create index push_send_uid_idx on np.push_send (firebase_uid, requested_at);
create index push_send_uid_reserved_idx on np.push_send (firebase_uid, reserved_at) where reserved_at is not null;

-- One reservation per send; one single-use attempt authorization per device, bound to the push channel.
create table np.push_send_reservation (
  id          uuid primary key default gen_random_uuid(),
  send_id     uuid not null unique references np.push_send(id),
  claim_owner text not null,
  created_at  timestamptz not null default now()
);
create table np.push_attempt_authorization (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references np.push_send_reservation(id) on delete cascade,
  send_id        uuid not null references np.push_send(id),
  device_id      uuid not null,
  channel        text not null default 'push' check (channel = 'push'),
  consumed_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (reservation_id, device_id)
);

create table np.push_device_attempt (
  id                  uuid primary key default gen_random_uuid(),
  send_id             uuid not null references np.push_send(id),
  device_id           uuid not null,
  attempt_no          integer not null check (attempt_no > 0),
  token_sha256        char(64) not null,
  provider            text not null check (provider in ('fcm', 'apns', 'mock')),
  outcome             text check (outcome in ('accepted', 'proven_dead_token', 'rate_limited', 'configuration_error', 'ambiguous')),
  provider_message_id text check (length(provider_message_id) <= 256),
  error_code          text check (length(error_code) <= 64),
  created_at          timestamptz not null default now(),
  settled_at          timestamptz,
  unique (send_id, device_id, attempt_no)
);
create index push_device_attempt_send_idx on np.push_device_attempt (send_id);

create table np.push_token_quarantine (
  token_sha256 char(64) primary key,
  reason       text not null check (length(reason) <= 64),
  created_at   timestamptz not null default now()
);

create table np.push_tap (
  id           uuid primary key default gen_random_uuid(),
  send_id      uuid not null references np.push_send(id),
  firebase_uid text not null,
  event_id     uuid not null,
  opened_at    timestamptz not null,
  received_at  timestamptz not null default now(),
  unique (send_id, event_id)
);
create index push_tap_send_idx on np.push_tap (send_id);

create table np.worker_lease (
  lease_key  text primary key,
  owner      text not null,
  expires_at timestamptz not null
);
create table np.worker_run (
  id          uuid primary key default gen_random_uuid(),
  owner       text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running' check (status in ('running', 'ok', 'error')),
  claimed     integer not null default 0,
  settled     integer not null default 0,
  errors      jsonb not null default '[]'::jsonb check (pg_column_size(errors) <= 8192)
);

-- Enqueue: one target, one approved version, idempotent on key. Returns the (possibly pre-existing) row.
create or replace function np.enqueue_push_send(p_firebase_uid text, p_version_id uuid, p_idempotency_key text, p_scheduled_at timestamptz, p_requested_by uuid)
returns np.push_send language plpgsql security definer set search_path = np, public as $$
declare s np.push_send;
begin
  if not exists (select 1 from np.push_creative_version where id = p_version_id) then
    raise exception 'version_not_found' using errcode = 'P0002';
  end if;
  insert into np.push_send (firebase_uid, creative_version_id, idempotency_key, scheduled_at, next_attempt_at, requested_by)
    values (p_firebase_uid, p_version_id, p_idempotency_key, coalesce(p_scheduled_at, now()), coalesce(p_scheduled_at, now()), p_requested_by)
    on conflict (idempotency_key) do nothing
    returning * into s;
  if s.id is null then
    select * into s from np.push_send where idempotency_key = p_idempotency_key;
    return s;
  end if;
  insert into np.operator_audit (actor, action, entity, metadata)
    values (p_requested_by, 'send.enqueue', 'send:' || s.id, jsonb_build_object('firebase_uid', p_firebase_uid, 'version_id', p_version_id));
  return s;
end $$;

-- Authenticated tap: the send must belong to the same verified UID. Duplicate event IDs are ignored.
create or replace function np.record_push_tap(p_send_id uuid, p_firebase_uid text, p_event_id uuid, p_opened_at timestamptz)
returns boolean language plpgsql security definer set search_path = np, public as $$
declare v_uid text;
begin
  select firebase_uid into v_uid from np.push_send where id = p_send_id;
  if v_uid is null or v_uid <> p_firebase_uid then raise exception 'send_not_owned' using errcode = '42501'; end if;
  insert into np.push_tap (send_id, firebase_uid, event_id, opened_at) values (p_send_id, p_firebase_uid, p_event_id, p_opened_at)
    on conflict (send_id, event_id) do nothing;
  return found;
end $$;
