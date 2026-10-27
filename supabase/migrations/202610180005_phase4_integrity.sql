-- Safe to resume a partial manual installation. Preserve existing archive cutoffs.
begin;

-- Attaching an activity must not reissue an existing completed/dismissed rule.
-- Content or condition edits still create a new recommendation revision.
create or replace function public.rule_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - array['activity_id', 'updated_at', 'revision'])
      is distinct from (to_jsonb(old) - array['activity_id', 'updated_at', 'revision']) then
    new.revision = old.revision + 1;
  else
    new.revision = old.revision;
  end if;
  return new;
end;
$$;

-- The server owns both timestamps and validates the minimum visual-break time.
create or replace function public.finish_activity_session(
  p_user_id uuid, p_session_id uuid, p_status text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.activity_sessions;
  elapsed int;
begin
  if p_status not in ('COMPLETED', 'CANCELLED') then
    raise exception 'Invalid status';
  end if;
  select * into s from public.activity_sessions
    where id = p_session_id and user_id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Session not found';
  end if;
  if s.status = p_status then return s.id; end if;
  if s.status <> 'STARTED' then
    raise exception using errcode = '40001', message = 'Session already ended';
  end if;
  if p_status = 'COMPLETED' and now() - s.started_at > interval '24 hours' then
    raise exception using errcode = '40001', message = 'Session expired; cancel and start again';
  end if;
  if p_status = 'COMPLETED' and s.source = 'TIMER'
      and now() - s.started_at < interval '20 seconds' then
    raise exception 'Take the 20-second break before confirming completion';
  end if;
  elapsed = greatest(0, least(14400, floor(extract(epoch from now() - s.started_at))::int));
  update public.activity_sessions set
    status = p_status,
    completed_at = case when p_status = 'COMPLETED' then now() else null end,
    duration_seconds = case when p_status = 'COMPLETED' then elapsed else null end
    where id = s.id;
  return s.id;
end;
$$;
revoke all on function public.finish_activity_session(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.finish_activity_session(uuid, uuid, text) to service_role;

create index if not exists activities_category_duration on public.wellness_activities(category, duration_seconds) where is_active;
-- Keep an immutable cutoff even if an archive request is retried later.
alter table public.wellness_goals add column if not exists archived_at timestamptz;

create or replace function public.set_goal_archive_time() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.status = 'ARCHIVED' then
    new.archived_at = coalesce(old.archived_at, old.updated_at);
  elsif new.status = 'ARCHIVED' then
    new.archived_at = now();
  else
    new.archived_at = null;
  end if;
  return new;
end;
$$;
do $$ begin
  if not exists (select 1 from pg_catalog.pg_trigger where tgrelid='public.wellness_goals'::regclass and tgname='goals_archive_time' and not tgisinternal) then
    create trigger goals_archive_time before insert or update on public.wellness_goals
      for each row execute function public.set_goal_archive_time();
  end if;
end; $$;
-- Backfill only missing cutoffs; preserve all existing archived timestamps.
update public.wellness_goals set archived_at = updated_at
  where status = 'ARCHIVED' and archived_at is null;
do $$ begin
  if not exists (select 1 from pg_catalog.pg_constraint where conrelid='public.wellness_goals'::regclass and conname='goal_archive_time_consistent') then
    alter table public.wellness_goals add constraint goal_archive_time_consistent check ((status = 'ARCHIVED') = (archived_at is not null));
  end if;
end; $$;
do $$ begin
  if not exists (select 1 from pg_catalog.pg_constraint where conrelid='public.wellness_goals'::regclass and conname='goal_pause_ranges_array') then
    alter table public.wellness_goals add constraint goal_pause_ranges_array check (jsonb_typeof(pause_ranges) = 'array');
  end if;
end; $$;
do $$ begin
  if not exists (select 1 from pg_catalog.pg_constraint where conrelid='public.wellness_goals'::regclass and conname='goal_definition_history_array') then
    alter table public.wellness_goals add constraint goal_definition_history_array check (jsonb_typeof(definition_history) = 'array');
  end if;
end; $$;

commit;
