-- Run: psql "$APP_SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/app/tests/reader_denied.sql
-- Proves the reader role cannot mutate and the registration RPC rotates/rebinds correctly.
begin;
select register_push_device('uid-a', 'install-0001', 'tok-aaaaaaaaaaaaaaaa', 'android', 'com.ambjn.neshpushandroid', true, 'A', 'UTC');
select register_push_device('uid-a', 'install-0001', 'tok-bbbbbbbbbbbbbbbb', 'android', 'com.ambjn.neshpushandroid', true, 'A', 'UTC');
do $$ begin
  if (select count(*) from push_device where firebase_uid = 'uid-a') <> 1 then raise exception 'rotation appended a row'; end if;
  perform register_push_device('uid-b', 'install-0001', 'tok-bbbbbbbbbbbbbbbb', 'android', 'com.ambjn.neshpushandroid', true, 'B', 'UTC');
  if (select firebase_uid from push_device where installation_id = 'install-0001') <> 'uid-b' then raise exception 'account switch did not rebind'; end if;
  perform revoke_push_device('uid-b', 'install-0001', 'android', 'com.ambjn.neshpushandroid');
  if (select revoked_at from push_device where installation_id = 'install-0001') is null then raise exception 'revoke failed'; end if;
  begin perform register_push_device('uid-a', 'x', 'tok', 'android', 'app', true, null, 'Mars/Olympus'); raise exception 'bad timezone accepted';
  exception when invalid_parameter_value then null; end;
end $$;
set local role source_reader;
do $$ begin
  begin insert into push_device (firebase_uid, installation_id, platform, provider, token, token_sha256, app_id) values ('x','y','android','fcm','t','h','a'); raise exception 'reader could insert';
  exception when insufficient_privilege then null; end;
  begin update push_device set revoked_at = now(); raise exception 'reader could update';
  exception when insufficient_privilege then null; end;
  begin delete from push_device; raise exception 'reader could delete';
  exception when insufficient_privilege then null; end;
  begin perform register_push_device('x','y','t','android','a',true,null,'UTC'); raise exception 'reader could call register';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
