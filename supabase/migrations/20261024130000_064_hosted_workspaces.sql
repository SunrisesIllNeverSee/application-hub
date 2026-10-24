-- Migration 064: hosted personal-workspace storage (m10 hosted-MCP path)
-- Status: DRAFT — gated on owner decision to amend the local-first contract.
-- Stores ONLY ciphertext rows + manifest docs; keys never reach the server.
-- Post-059 rule: RLS + REVOKE + explicit GRANT in the same file. Idempotent, transactional.

begin;

create table if not exists public.aqua_workspaces (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  workspace_id text not null unique,
  manifest jsonb not null,
  manifest_rev bigint not null default 1,
  schema_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aqua_workspace_records (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.aqua_workspaces(id) on delete cascade,
  path text not null,
  rid text not null,
  kind text not null,
  authority text not null,
  scope text not null,
  status text not null default 'live',
  sha256 text not null,
  file jsonb not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, path)
);
create index if not exists aqua_ws_records_ws_kind on public.aqua_workspace_records (workspace_id, kind, status);

create table if not exists public.aqua_workspace_audit (
  id bigint generated always as identity primary key,
  account_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.aqua_workspaces(id) on delete cascade,
  log_name text not null,
  seq int not null,
  entry jsonb not null,
  prev text,
  at timestamptz not null default now(),
  unique (workspace_id, log_name, seq)
);

create or replace function public.aqua_workspaces_touch() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists aqua_workspaces_touch on public.aqua_workspaces;
create trigger aqua_workspaces_touch before update on public.aqua_workspaces
  for each row execute function public.aqua_workspaces_touch();

alter table public.aqua_workspaces enable row level security;
alter table public.aqua_workspace_records enable row level security;
alter table public.aqua_workspace_audit enable row level security;

revoke all on public.aqua_workspaces from public, anon, authenticated, service_role;
revoke all on public.aqua_workspace_records from public, anon, authenticated, service_role;
revoke all on public.aqua_workspace_audit from public, anon, authenticated, service_role;

drop policy if exists aqua_workspaces_owner on public.aqua_workspaces;
create policy aqua_workspaces_owner on public.aqua_workspaces
  for all using (account_id = auth.uid()) with check (account_id = auth.uid());
drop policy if exists aqua_ws_records_owner on public.aqua_workspace_records;
create policy aqua_ws_records_owner on public.aqua_workspace_records
  for all using (account_id = auth.uid())
  with check (account_id = auth.uid()
    and exists (select 1 from public.aqua_workspaces w
                where w.id = workspace_id and w.account_id = auth.uid()));
drop policy if exists aqua_ws_audit_owner on public.aqua_workspace_audit;
create policy aqua_ws_audit_owner on public.aqua_workspace_audit
  for select using (account_id = auth.uid());
drop policy if exists aqua_ws_audit_owner_ins on public.aqua_workspace_audit;
create policy aqua_ws_audit_owner_ins on public.aqua_workspace_audit
  for insert with check (account_id = auth.uid()
    and exists (select 1 from public.aqua_workspaces w
                where w.id = workspace_id and w.account_id = auth.uid()));
-- audit is append-only: no UPDATE/DELETE grant anywhere

-- Caller-scoped grants (INVOKER RPC + RLS do the isolation); service_role for server ops.
grant select, insert, update on public.aqua_workspaces to authenticated;
grant select, insert, update on public.aqua_workspace_records to authenticated;
grant select, insert on public.aqua_workspace_audit to authenticated;
grant select, insert, update, delete on public.aqua_workspaces to service_role;
grant select, insert, update, delete on public.aqua_workspace_records to service_role;
grant select, insert on public.aqua_workspace_audit to service_role;

-- CAS commit RPC — SECURITY INVOKER so the caller's RLS enforces account
-- isolation for free (no cross-tenant writes possible; matches 061 convention).
create or replace function public.aqua_workspace_commit(
  p_workspace_id uuid,
  p_expected_rev bigint,
  p_manifest jsonb,
  p_records jsonb,
  p_audit jsonb
) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_new_rev bigint;
  r jsonb;
  a jsonb;
begin
  update public.aqua_workspaces
     set manifest = p_manifest, manifest_rev = manifest_rev + 1
   where id = p_workspace_id and manifest_rev = p_expected_rev and account_id = auth.uid()
  returning manifest_rev into v_new_rev;
  if not found then
    raise exception 'manifest_rev_conflict';
  end if;
  for r in select * from jsonb_array_elements(p_records) loop
    insert into public.aqua_workspace_records
      (account_id, workspace_id, path, rid, kind, authority, scope, status, sha256, file)
    values
      (auth.uid(), p_workspace_id, r->>'path', r->>'rid', r->>'kind',
       r->>'authority', r->>'scope', coalesce(r->>'status','live'), r->>'sha256',
       decode(r->>'file_b64', 'base64'));
  end loop;
  for a in select * from jsonb_array_elements(p_audit) loop
    insert into public.aqua_workspace_audit (account_id, workspace_id, log_name, seq, entry, prev)
    values (auth.uid(), p_workspace_id, a->>'log_name', (a->>'seq')::int, a->'entry', a->>'prev');
  end loop;
  return v_new_rev;
end $$;

revoke all on function public.aqua_workspaces_touch() from public, anon, authenticated, service_role;
revoke all on function public.aqua_workspace_commit(uuid, bigint, jsonb, jsonb, jsonb) from public, anon, service_role;
grant execute on function public.aqua_workspace_commit(uuid, bigint, jsonb, jsonb, jsonb) to authenticated;

commit;
