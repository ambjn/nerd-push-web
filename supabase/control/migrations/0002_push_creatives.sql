create table np.push_creative (
  id             uuid primary key default gen_random_uuid(),
  label          text not null check (length(label) between 1 and 80),
  title_template text not null check (length(title_template) between 1 and 65),
  body_template  text not null check (length(body_template) between 1 and 240),
  route_key      text not null check (route_key in ('home', 'details')),
  message_class  text not null default 'transactional' check (message_class in ('transactional', 'marketing')),
  status         text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  row_version    bigint not null default 1,
  created_by     uuid not null,
  approved_by    uuid,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table np.push_creative_version (
  id              uuid primary key default gen_random_uuid(),
  creative_id     uuid not null references np.push_creative(id),
  version         integer not null check (version > 0),
  title_template  text not null,
  body_template   text not null,
  route_key       text not null,
  message_class   text not null,
  artifact_sha256 char(64) not null,
  approved_by     uuid not null,
  approved_at     timestamptz not null default now(),
  unique (creative_id, version)
);
-- Immutable after approval: versions never change.
create trigger push_creative_version_immutable before update or delete on np.push_creative_version
  for each row execute function np.deny_change();

-- Content may only change while draft; row_version advances on every change.
create or replace function np.push_creative_guard() returns trigger language plpgsql as $$
begin
  if old.status <> 'draft' and (new.title_template, new.body_template, new.route_key, new.message_class)
     is distinct from (old.title_template, old.body_template, old.route_key, old.message_class) then
    raise exception 'creative % is not a draft' using errcode = '42501';
  end if;
  new.row_version := old.row_version + 1;
  new.updated_at := now();
  return new;
end $$;
create trigger push_creative_guard before update on np.push_creative
  for each row execute function np.push_creative_guard();

-- Canonical artifact fingerprint shared with lib/push/creative.ts: fields joined by U+001F.
create or replace function np.creative_fingerprint(p_title text, p_body text, p_route text, p_class text)
returns char(64) language sql immutable as $$
  select encode(extensions.digest(concat_ws(chr(31), p_title, p_body, p_route, p_class), 'sha256'), 'hex')::char(64);
$$;

-- Approval transaction: compare-and-swap on row_version, freeze a version, audit.
-- p_sha256 is the fingerprint the server computed from the content it linted;
-- a mismatch means the row changed underneath the lint and the approval is refused.
create or replace function np.approve_creative(p_creative_id uuid, p_actor uuid, p_expected_row_version bigint, p_sha256 char(64))
returns uuid language plpgsql security definer set search_path = np, public, extensions as $$
declare c np.push_creative; v_version_id uuid; v_no integer;
begin
  select * into c from np.push_creative where id = p_creative_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if c.status <> 'draft' then raise exception 'not_draft' using errcode = '42501'; end if;
  if c.row_version <> p_expected_row_version then raise exception 'stale_row_version' using errcode = '40001'; end if;
  if np.creative_fingerprint(c.title_template, c.body_template, c.route_key, c.message_class) <> p_sha256 then
    raise exception 'fingerprint_mismatch' using errcode = '40001';
  end if;
  select coalesce(max(version), 0) + 1 into v_no from np.push_creative_version where creative_id = p_creative_id;
  insert into np.push_creative_version (creative_id, version, title_template, body_template, route_key, message_class, artifact_sha256, approved_by)
    values (p_creative_id, v_no, c.title_template, c.body_template, c.route_key, c.message_class, p_sha256, p_actor)
    returning id into v_version_id;
  update np.push_creative set status = 'approved', approved_by = p_actor, approved_at = now() where id = p_creative_id;
  insert into np.operator_audit (actor, action, entity, metadata)
    values (p_actor, 'creative.approve', 'creative:' || p_creative_id, jsonb_build_object('version_id', v_version_id, 'version', v_no, 'sha256', p_sha256));
  return v_version_id;
end $$;
