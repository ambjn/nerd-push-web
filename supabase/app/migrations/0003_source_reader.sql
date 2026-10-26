-- SELECT-only role for the control worker. Mint a JWT with {"role":"source_reader"}
-- signed by A's JWT secret and store it as APP_SOURCE_READER_JWT (server-only).
create role source_reader nologin;
grant source_reader to authenticator;
grant usage on schema public to source_reader;
grant select (firebase_uid, display_name, timezone, created_at, updated_at) on public.app_user to source_reader;
grant select on public.notification_preference to source_reader;
-- The reader sees token plaintext because it must hand it to the provider; nothing else is granted.
grant select (id, firebase_uid, installation_id, platform, provider, token, token_sha256, app_id, environment,
              notifications_enabled, registered_at, last_seen_at, revoked_at) on public.push_device to source_reader;

create policy source_reader_app_user on public.app_user for select to source_reader using (true);
create policy source_reader_pref on public.notification_preference for select to source_reader using (true);
create policy source_reader_device on public.push_device for select to source_reader using (revoked_at is null);
-- Verified by supabase/app/tests/reader_denied.sql: INSERT/UPDATE/DELETE and both RPCs fail for source_reader.
