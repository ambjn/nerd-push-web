-- One FCM token per signed-in Firebase user. Written only by the server (service role) after verifying a Firebase ID token.
create table public.push_device (
  firebase_uid text primary key,
  display_name text,
  token        text not null,
  updated_at   timestamptz not null default now()
);
alter table public.push_device enable row level security;
revoke all on public.push_device from anon, authenticated;
