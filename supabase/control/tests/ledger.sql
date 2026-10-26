-- Run: psql "$CONTROL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/control/tests/ledger.sql
-- Single-session checks for the permit path. Two-worker SKIP LOCKED behaviour needs two sessions; see documents.md.
begin;
set local search_path = np, public, extensions;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'test-op@example.com') on conflict do nothing;
select np.bootstrap_operator('test-op@example.com', 'admin');
insert into np.push_creative (id, label, title_template, body_template, route_key, created_by)
  values ('00000000-0000-0000-0000-00000000c001', 'test', 'Hi', 'Body', 'home', '00000000-0000-0000-0000-000000000001');
do $$
declare v_version uuid; s1 np.push_send; s2 np.push_send; v_res uuid; v_auth uuid; v_att uuid; n integer;
  fp char(64) := np.creative_fingerprint('Hi','Body','home','transactional');
  d1 uuid[] := array['00000000-0000-0000-0000-00000000d001']::uuid[];
begin
  v_version := np.approve_creative('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000000001', 1, fp);
  begin perform np.approve_creative('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000000001', 2, fp); raise exception 'approved twice';
  exception when insufficient_privilege then null; end;
  begin update np.push_creative_version set title_template = 'x' where id = v_version; raise exception 'version mutable';
  exception when insufficient_privilege then null; end;

  s1 := np.enqueue_push_send('uid-1', v_version, 'idem-key-0001', null, '00000000-0000-0000-0000-000000000001');
  s2 := np.enqueue_push_send('uid-1', v_version, 'idem-key-0001', null, '00000000-0000-0000-0000-000000000001');
  if s1.id <> s2.id then raise exception 'idempotency key produced two sends'; end if;

  select count(*) into n from np.claim_due_push_sends('w1', 10);
  if n <> 1 then raise exception 'claim count %', n; end if;
  select count(*) into n from np.claim_due_push_sends('w2', 10);
  if n <> 0 then raise exception 'second worker claimed an owned row'; end if;

  begin perform np.reserve_push_send(s1.id, 'w2', v_version, fp, d1, '{}'); raise exception 'wrong owner reserved';
  exception when insufficient_privilege then null; end;
  begin perform np.reserve_push_send(s1.id, 'w1', v_version, fp, d1, '{}'); raise exception 'non-allowlisted reserved';
  exception when insufficient_privilege then null; end;
  insert into np.push_allowlist (firebase_uid, reason, added_by) values ('uid-1', 'test', '00000000-0000-0000-0000-000000000001');
  v_res := np.reserve_push_send(s1.id, 'w1', v_version, fp, d1, '{}');
  begin perform np.reserve_push_send(s1.id, 'w1', v_version, fp, d1, '{}'); raise exception 'reserved twice';
  exception when insufficient_privilege then null; end;

  select id into v_auth from np.push_attempt_authorization where reservation_id = v_res;
  v_att := np.consume_attempt_authorization(v_auth, 'w1', repeat('a', 64), 'mock');
  begin perform np.consume_attempt_authorization(v_auth, 'w1', repeat('a', 64), 'mock'); raise exception 'permit reused';
  exception when insufficient_privilege then null; end;
  if (select provider_attempted_at from np.push_send where id = s1.id) is null then raise exception 'attempt not stamped'; end if;
  perform np.settle_push_device_attempt(v_att, 'w1', 'accepted', 'm1', null);
  perform np.settle_push_send(s1.id, 'w1', 'accepted', null);
  if (select status from np.push_send where id = s1.id) <> 'accepted' then raise exception 'settle failed'; end if;

  -- cap: second send for the same uid within 24h is refused under the permit
  s2 := np.enqueue_push_send('uid-1', v_version, 'idem-key-0002', null, '00000000-0000-0000-0000-000000000001');
  perform np.claim_due_push_sends('w1', 10);
  begin perform np.reserve_push_send(s2.id, 'w1', v_version, fp, d1, '{}'); raise exception 'cap not enforced';
  exception when insufficient_privilege then if sqlerrm <> 'cap_24h' then raise; end if; end;
  perform np.skip_push_send(s2.id, 'w1', 'cap_24h');

  -- tap: wrong uid refused, duplicate event ignored
  begin perform np.record_push_tap(s1.id, 'uid-other', '00000000-0000-0000-0000-00000000e001', now()); raise exception 'tap for other uid accepted';
  exception when insufficient_privilege then null; end;
  if not np.record_push_tap(s1.id, 'uid-1', '00000000-0000-0000-0000-00000000e001', now()) then raise exception 'tap not recorded'; end if;
  if np.record_push_tap(s1.id, 'uid-1', '00000000-0000-0000-0000-00000000e001', now()) then raise exception 'duplicate tap recorded'; end if;

  -- recovery: unstamped stale -> pending, stamped stale -> delivery_unknown
  insert into np.push_allowlist (firebase_uid, reason, added_by) values ('uid-2', 'test', '00000000-0000-0000-0000-000000000001');
  s2 := np.enqueue_push_send('uid-2', v_version, 'idem-key-0003', null, '00000000-0000-0000-0000-000000000001');
  perform np.claim_due_push_sends('w3', 10);
  perform np.reserve_push_send(s2.id, 'w3', v_version, fp, array['00000000-0000-0000-0000-00000000d002']::uuid[], '{}');
  update np.push_send set claimed_at = now() - interval '1 hour' where id = s2.id;
  perform np.recover_stale_push_claims('10 minutes');
  if (select status from np.push_send where id = s2.id) <> 'pending' then raise exception 'unstamped not recovered'; end if;
  update np.push_send set status = 'sending', claim_owner = 'w4', claimed_at = now() - interval '1 hour', provider_attempted_at = now() where id = s2.id;
  perform np.recover_stale_push_claims('10 minutes');
  if (select status from np.push_send where id = s2.id) <> 'delivery_unknown' then raise exception 'stamped not marked unknown'; end if;
end $$;
rollback;
