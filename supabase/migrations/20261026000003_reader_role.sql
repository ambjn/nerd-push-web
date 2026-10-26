-- Read-only bridge: a login role that can only SELECT push_device. The dashboard's test-send path reads the
-- registered (logged-in) users through it; it can never write. The password is set out of band:
--   alter role nerdpush_reader with login password '<secret>';
create role nerdpush_reader nologin;
grant usage on schema public to nerdpush_reader;
grant select on public.push_device to nerdpush_reader;
create policy nerdpush_reader_select on public.push_device for select to nerdpush_reader using (true);
