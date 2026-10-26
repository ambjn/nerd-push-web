-- Claim / reserve / consume / settle / recover. All owner-checked, all under row locks.

create or replace function np.acquire_worker_lease(p_key text, p_owner text, p_ttl interval) returns boolean
language sql security definer set search_path = np as $$
  insert into np.worker_lease (lease_key, owner, expires_at) values (p_key, p_owner, now() + p_ttl)
    on conflict (lease_key) do update set owner = excluded.owner, expires_at = excluded.expires_at
    where np.worker_lease.expires_at < now()
  returning true;
$$;

create or replace function np.release_worker_lease(p_key text, p_owner text) returns void
language sql security definer set search_path = np as $$
  delete from np.worker_lease where lease_key = p_key and owner = p_owner;
$$;

-- 1. Bounded due batch, SKIP LOCKED, unique owner stamp. Abandoned claims older than 10 minutes are re-claimable.
create or replace function np.claim_due_push_sends(p_owner text, p_limit integer) returns setof np.push_send
language sql security definer set search_path = np as $$
  update np.push_send s set claim_owner = p_owner, claimed_at = now()
  where s.id in (
    select id from np.push_send
     where status = 'pending' and next_attempt_at <= now()
       and (claim_owner is null or claimed_at < now() - interval '10 minutes')
     order by next_attempt_at, id limit greatest(1, least(p_limit, 50))
     for update skip locked)
  returning s.*;
$$;

-- 2a. Release without any attempt (source outage, quiet hours): back to pending at a later time.
create or replace function np.release_push_claim(p_send_id uuid, p_owner text, p_next_attempt_at timestamptz, p_error_code text) returns void
language plpgsql security definer set search_path = np as $$
begin
  update np.push_send set claim_owner = null, claimed_at = null, next_attempt_at = p_next_attempt_at, error_code = p_error_code
   where id = p_send_id and claim_owner = p_owner and status = 'pending';
  if not found then raise exception 'not_owner_or_not_pending' using errcode = '42501'; end if;
end $$;

-- 2b. Known no-send decision recorded without a provider attempt.
create or replace function np.skip_push_send(p_send_id uuid, p_owner text, p_error_code text) returns void
language plpgsql security definer set search_path = np as $$
begin
  update np.push_send set status = 'skipped', error_code = p_error_code, finished_at = now(), claim_owner = null
   where id = p_send_id and claim_owner = p_owner and status = 'pending';
  if not found then raise exception 'not_owner_or_not_pending' using errcode = '42501'; end if;
  insert into np.operator_audit (actor, action, entity, metadata) values (null, 'send.skip', 'send:' || p_send_id, jsonb_build_object('reason', p_error_code));
end $$;

-- 3. The permit. Requires pending + owner + approved frozen version/fingerprint + exact allowlist + transactional + caps.
--    Caps are counted under a per-recipient transaction lock so two sends cannot both pass.
create or replace function np.reserve_push_send(p_send_id uuid, p_owner text, p_version_id uuid, p_sha256 char(64), p_device_ids uuid[], p_snapshot jsonb)
returns uuid language plpgsql security definer set search_path = np as $$
declare s np.push_send; v np.push_creative_version; pol np.push_policy; v_res uuid; n24 integer; n7 integer;
begin
  select * into s from np.push_send where id = p_send_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if s.status <> 'pending' then raise exception 'not_pending' using errcode = '42501'; end if;
  if s.claim_owner is distinct from p_owner then raise exception 'not_owner' using errcode = '42501'; end if;
  if s.creative_version_id <> p_version_id then raise exception 'version_mismatch' using errcode = '42501'; end if;
  select * into v from np.push_creative_version where id = p_version_id;
  if not found or v.artifact_sha256 <> p_sha256 then raise exception 'fingerprint_mismatch' using errcode = '42501'; end if;
  if v.message_class <> 'transactional' then raise exception 'not_transactional' using errcode = '42501'; end if;
  if not exists (select 1 from np.push_allowlist where firebase_uid = s.firebase_uid and enabled) then
    raise exception 'not_allowlisted' using errcode = '42501';
  end if;
  if coalesce(array_length(p_device_ids, 1), 0) = 0 then raise exception 'no_device' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtext('np.push_cap:' || s.firebase_uid));
  select * into pol from np.push_policy;
  select count(*) filter (where reserved_at > now() - interval '24 hours'), count(*) filter (where reserved_at > now() - interval '7 days')
    into n24, n7 from np.push_send where firebase_uid = s.firebase_uid and reserved_at is not null and id <> s.id;
  if n24 >= pol.max_24h then raise exception 'cap_24h' using errcode = '42501'; end if;
  if n7 >= pol.max_7d then raise exception 'cap_7d' using errcode = '42501'; end if;

  update np.push_send set status = 'sending', reserved_at = now(), rendered_snapshot = p_snapshot, error_code = null where id = p_send_id;
  insert into np.push_send_reservation (send_id, claim_owner) values (p_send_id, p_owner) returning id into v_res;
  insert into np.push_attempt_authorization (reservation_id, send_id, device_id)
    select v_res, p_send_id, d from unnest(p_device_ids) as d;
  return v_res;
end $$;

-- 4. Consume one single-use authorization and persist the device attempt BEFORE the provider call.
create or replace function np.consume_attempt_authorization(p_auth_id uuid, p_owner text, p_token_sha256 char(64), p_provider text)
returns uuid language plpgsql security definer set search_path = np as $$
declare a np.push_attempt_authorization; r np.push_send_reservation; v_attempt uuid; v_no integer;
begin
  select * into a from np.push_attempt_authorization where id = p_auth_id for update;
  if not found then raise exception 'authorization_not_found' using errcode = 'P0002'; end if;
  if a.consumed_at is not null then raise exception 'authorization_consumed' using errcode = '42501'; end if;
  if a.channel <> 'push' then raise exception 'wrong_channel' using errcode = '42501'; end if;
  select * into r from np.push_send_reservation where id = a.reservation_id;
  if r.claim_owner <> p_owner then raise exception 'not_owner' using errcode = '42501'; end if;
  update np.push_attempt_authorization set consumed_at = now() where id = p_auth_id;
  select coalesce(max(attempt_no), 0) + 1 into v_no from np.push_device_attempt where send_id = a.send_id and device_id = a.device_id;
  insert into np.push_device_attempt (send_id, device_id, attempt_no, token_sha256, provider)
    values (a.send_id, a.device_id, v_no, p_token_sha256, p_provider) returning id into v_attempt;
  update np.push_send set provider_attempted_at = coalesce(provider_attempted_at, now()) where id = a.send_id;
  return v_attempt;
end $$;

create or replace function np.settle_push_device_attempt(p_attempt_id uuid, p_owner text, p_outcome text, p_message_id text, p_error_code text) returns void
language plpgsql security definer set search_path = np as $$
begin
  update np.push_device_attempt d set outcome = p_outcome, provider_message_id = p_message_id, error_code = p_error_code, settled_at = now()
   from np.push_send s where d.id = p_attempt_id and s.id = d.send_id and s.claim_owner = p_owner and d.settled_at is null;
  if not found then raise exception 'attempt_not_settleable' using errcode = '42501'; end if;
  if p_outcome = 'proven_dead_token' then
    insert into np.push_token_quarantine (token_sha256, reason)
      select token_sha256, coalesce(p_error_code, 'dead_token') from np.push_device_attempt where id = p_attempt_id
      on conflict do nothing;
  end if;
end $$;

-- 5. Finish the send. Only the owner, only from sending, only to a terminal state.
create or replace function np.settle_push_send(p_send_id uuid, p_owner text, p_status text, p_error_code text) returns void
language plpgsql security definer set search_path = np as $$
begin
  if p_status not in ('accepted', 'failed', 'delivery_unknown') then raise exception 'bad_status' using errcode = '22023'; end if;
  update np.push_send set status = p_status, error_code = p_error_code, finished_at = now(), claim_owner = null,
         provider_accepted_at = case when p_status = 'accepted' then now() else provider_accepted_at end
   where id = p_send_id and claim_owner = p_owner and status = 'sending';
  if not found then raise exception 'not_owner_or_not_sending' using errcode = '42501'; end if;
  insert into np.operator_audit (actor, action, entity, metadata) values (null, 'send.settle', 'send:' || p_send_id, jsonb_build_object('status', p_status, 'error', p_error_code));
end $$;

-- 5b. Bounded retry after definite rate limiting: back to pending with backoff; the reservation is spent.
create or replace function np.requeue_push_send(p_send_id uuid, p_owner text, p_next_attempt_at timestamptz, p_error_code text) returns void
language plpgsql security definer set search_path = np as $$
declare s np.push_send;
begin
  select * into s from np.push_send where id = p_send_id for update;
  if s.claim_owner is distinct from p_owner or s.status <> 'sending' then raise exception 'not_owner_or_not_sending' using errcode = '42501'; end if;
  if s.retry_count >= 3 then
    update np.push_send set status = 'failed', error_code = 'retry_exhausted', finished_at = now(), claim_owner = null where id = p_send_id;
    return;
  end if;
  delete from np.push_send_reservation where send_id = p_send_id;
  update np.push_send set status = 'pending', claim_owner = null, claimed_at = null, next_attempt_at = p_next_attempt_at,
         error_code = p_error_code, retry_count = retry_count + 1, reserved_at = null where id = p_send_id;
end $$;

-- 6. Recovery. Unstamped stale claims return to pending; stamped-but-unsettled become delivery_unknown for review.
create or replace function np.recover_stale_push_claims(p_stale interval) returns table (recovered integer, unknown integer)
language plpgsql security definer set search_path = np as $$
declare n1 integer; n2 integer;
begin
  with stale as (
    select id from np.push_send where status = 'sending' and claimed_at < now() - p_stale and provider_attempted_at is null for update skip locked
  ), del as (delete from np.push_send_reservation where send_id in (select id from stale))
  update np.push_send s set status = 'pending', claim_owner = null, claimed_at = null, reserved_at = null, error_code = 'recovered_unstamped'
   where s.id in (select id from stale);
  get diagnostics n1 = row_count;
  update np.push_send set status = 'delivery_unknown', claim_owner = null, finished_at = now(), error_code = 'recovered_stamped'
   where status = 'sending' and claimed_at < now() - p_stale and provider_attempted_at is not null;
  get diagnostics n2 = row_count;
  update np.push_send set claim_owner = null, claimed_at = null where status = 'pending' and claim_owner is not null and claimed_at < now() - p_stale;
  return query select n1, n2;
end $$;
