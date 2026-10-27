-- REPAIR VERSION: 2026-10-27-r2
-- ScreenWise: resume partially installed Phase 4 integrity and Phase 6 analytics.
-- Copy this COMPLETE file into a NEW Supabase SQL Editor query and run.
-- Existing indexes, columns, triggers, constraints and archive cutoffs are retained.
-- No tables, users or wellness records are deleted.
-- Includes safe 005 repair, current 008 functions, permissions and schema reload.

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

-- Phase 6 aggregation functions
begin;
-- Requires 001-007, in particular wellness_goals.archived_at from 005.
-- No summary tables or data rewrites. Existing owner/date indexes are reused.
create index if not exists sessions_completed_date_analytics on public.activity_sessions(completed_at,user_id)
  where status='COMPLETED' and completed_at is not null;
create index if not exists attempts_date_analytics on public.assessment_attempts(submitted_at,user_id);
create index if not exists profiles_created_analytics on public.profiles(created_at);

-- The API supplies the verified owner. Browser roles cannot execute these functions.
-- SECURITY INVOKER, fixed search_path, service_role only; existing RLS is preserved.
create or replace function public.personal_wellness_analytics(
 p_user_id uuid,p_start date,p_end date,p_timezone text,p_category text default null,
 p_page int default 1,p_page_size int default 20
) returns jsonb language plpgsql stable set search_path='' as $$
declare lo timestamptz; hi timestamptz; result jsonb;
begin
 if p_start is null or p_end is null or p_end<p_start or p_end-p_start>365
   or p_page<1 or p_page>100000 or p_page_size<1 or p_page_size>100 then raise exception 'Invalid reporting range';end if;
 lo=p_start::timestamp at time zone p_timezone;
 hi=(p_end+1)::timestamp at time zone p_timezone;
 with sessions as materialized (
   select id,activity_id,completed_at,duration_seconds,activity_snapshot from public.activity_sessions
   where user_id=p_user_id and status='COMPLETED' and completed_at>=lo and completed_at<hi
 ), attempts as materialized (
   select id,assessment_id,assessment_title,category,submitted_at,normalized_score,feedback_category,
     explanation,compatibility_key,version_number
   from public.assessment_attempts where user_id=p_user_id and submitted_at>=lo and submitted_at<hi
 ), points as (
   select id,submitted_at,category,assessment_id,compatibility_key,jsonb_build_object(
    'id',id,'assessmentId',assessment_id,'title',assessment_title,'category',category,'date',submitted_at,
    'score',normalized_score,'feedback',feedback_category,'explanation',explanation,
    'compatibilityKey',compatibility_key,'version',version_number) point
   from attempts where p_category is null or category=p_category
 ), series as (
   select assessment_id,compatibility_key,jsonb_build_object('assessmentId',assessment_id,
    'title',max(point->>'title'),'category',max(category),'compatibilityKey',compatibility_key,
    'points',jsonb_agg(point order by submitted_at,id)) item
   from points group by assessment_id,compatibility_key
 ), daily as (
   select (completed_at at time zone p_timezone)::date local_day,count(*) n from sessions group by 1
 ), events as (
   select id,'activity' kind,activity_snapshot->>'title' title,activity_snapshot->>'category' category,
     completed_at as occurred_at,duration_seconds duration from sessions
   union all select id,'assessment',assessment_title,category,submitted_at,null::int from attempts
 ), owner_goals as (
   select g.*,coalesce((select jsonb_agg(l.activity_id order by l.activity_id)
     from public.goal_activity_links l where l.goal_id=g.id),'[]') activity_ids
   from public.wellness_goals g where g.user_id=p_user_id
     and g.created_at<((p_end+1)::timestamp at time zone g.timezone)
 ), goal_counts as (
   select g.id,(s.completed_at at time zone g.timezone)::date local_day,count(*) n
   from owner_goals g join public.goal_activity_links l on l.goal_id=g.id
   join public.activity_sessions s on s.activity_id=l.activity_id and s.user_id=p_user_id
     and s.status='COMPLETED' and s.completed_at is not null
     and s.completed_at >= greatest(g.start_date,g.tracking_start)::timestamp at time zone g.timezone
     and s.completed_at < ((coalesce(g.end_date,(now() at time zone g.timezone)::date)+1)::timestamp at time zone g.timezone)
     and s.completed_at <= least(now(),((p_end+1)::timestamp at time zone g.timezone)-interval '1 millisecond')
     and (g.status<>'ARCHIVED' or s.completed_at<=coalesce(g.archived_at,g.updated_at))
   group by g.id,(s.completed_at at time zone g.timezone)::date
 )
 select jsonb_build_object(
  'period',jsonb_build_object('startDate',p_start,'endDate',p_end,'timezone',p_timezone),
  'generatedAt',now(),'fullName',(select full_name from public.profiles where id=p_user_id),
  'overview',jsonb_build_object('assessments',(select count(*) from attempts),'activities',(select count(*) from sessions)),
  'daily',(select jsonb_agg(jsonb_build_object('date',d::date,'count',coalesce(n,0)) order by d)
     from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d left join daily on daily.local_day=d::date),
  'distribution',(select coalesce(jsonb_agg(jsonb_build_object('category',category,'count',n) order by category),'[]')
     from (select coalesce(activity_snapshot->>'category','GENERAL') category,count(*) n from sessions group by 1) c),
  'assessments',(select coalesce(jsonb_agg(item order by assessment_id,compatibility_key),'[]') from series),
  'assessmentHistory',jsonb_build_object('rows',(select coalesce(jsonb_agg(point order by submitted_at desc,id),'[]') from
      (select * from points order by submitted_at desc,id limit p_page_size offset (p_page-1)*p_page_size) p),
      'total',(select count(*) from points),'page',p_page,'pageSize',p_page_size),
  'timeline',jsonb_build_object('rows',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'title',title,
     'category',category,'date',occurred_at,'durationSeconds',duration) order by occurred_at desc,id),'[]') from
     (select * from events order by occurred_at desc,id limit p_page_size offset (p_page-1)*p_page_size) e),
     'total',(select count(*) from events),'page',p_page,'pageSize',p_page_size),
  'goalDefinitions',(select coalesce(jsonb_agg(to_jsonb(g) order by g.created_at,g.id),'[]') from owner_goals g),
  'goalAsOf',(select coalesce(jsonb_object_agg(id,least(now(),((p_end+1)::timestamp at time zone timezone)-interval '1 millisecond')),'{}') from owner_goals),
  'goalCounts',(select coalesce(jsonb_object_agg(id,counts),'{}') from
     (select id,jsonb_object_agg(local_day,n) counts from goal_counts group by id) c)
 ) into result;
 return result;
end;$$;

create or replace function public.dashboard_wellness_summary(p_user_id uuid,p_timezone text) returns jsonb
language sql stable set search_path='' as $$
 with bounds as (select (now() at time zone p_timezone)::date today), today_sessions as materialized (
   select s.activity_id from public.activity_sessions s,bounds
   where s.user_id=p_user_id and s.status='COMPLETED'
     and s.completed_at>=today::timestamp at time zone p_timezone
     and s.completed_at<(today+1)::timestamp at time zone p_timezone
 ), checklist as (
   select activity_snapshot from public.daily_wellness_checklists,bounds
     where user_id=p_user_id and date=today and timezone=p_timezone
 ), latest as (
   select * from public.assessment_attempts where user_id=p_user_id order by submitted_at desc,id limit 1
 ) select jsonb_build_object(
  'latestAssessment',(select jsonb_build_object('id',id,'assessmentId',assessment_id,'title',assessment_title,
   'category',category,'date',submitted_at,'score',normalized_score,'feedback',feedback_category,
   'explanation',explanation,'compatibilityKey',compatibility_key,'version',version_number) from latest),
  'todayActivities',jsonb_build_object('completed',(select count(*) from today_sessions),
    'target',(select jsonb_array_length(activity_snapshot) from checklist),
    'plannedCompleted',(select count(distinct s.activity_id) from today_sessions s,checklist c where exists(
      select 1 from jsonb_array_elements(c.activity_snapshot) a where a->>'id'=s.activity_id::text)))
 );$$;

-- If any nonempty bucket has fewer than five distinct contributors, suppress the
-- entire breakdown (including zeros) to prevent complementary subtraction.
create or replace function public.suppress_analytics_buckets(p_buckets jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('label',x->>'label',
   'value',case when hidden then null else (x->>'count')::bigint end,'suppressed',hidden) order by ord),'[]')
 from jsonb_array_elements(p_buckets) with ordinality e(x,ord)
 cross join (select exists(select 1 from jsonb_array_elements(p_buckets) b where
    (b->>'count')::bigint>0 and (b->>'actors')::bigint<5) hidden) h;
$$;
create or replace function public.admin_wellness_analytics(p_admin_id uuid,p_start date,p_end date,p_timezone text)
returns jsonb language plpgsql stable set search_path='' as $$
declare lo timestamptz;hi timestamptz;result jsonb;active_n bigint;private_hidden boolean;breakdown text;
begin
 if not exists(select 1 from public.profiles where id=p_admin_id and role='ADMIN') then
   raise exception using errcode='42501',message='Administrator access required';end if;
 if p_start is null or p_end is null or p_end<p_start or p_end-p_start>365 then raise exception 'Invalid reporting range';end if;
 lo=p_start::timestamp at time zone p_timezone;hi=(p_end+1)::timestamp at time zone p_timezone;
 with events as materialized (
   select user_id,submitted_at as occurred_at,'assessment' kind,category from public.assessment_attempts where submitted_at>=lo and submitted_at<hi
   union all select user_id,completed_at,'activity',coalesce(activity_snapshot->>'category','GENERAL')
     from public.activity_sessions where status='COMPLETED' and completed_at>=lo and completed_at<hi
 ), registrations as (
   select (created_at at time zone p_timezone)::date local_day,count(*) n from public.profiles
   where created_at>=lo and created_at<hi group by 1
 ), usage_counts as (
   select kind,category,count(*) n,count(distinct user_id) actors from events group by kind,category
 ), engagement as (
   select (occurred_at at time zone p_timezone)::date local_day,count(*) n,count(distinct user_id) actors from events group by 1
 ) select jsonb_build_object(
   'period',jsonb_build_object('startDate',p_start,'endDate',p_end,'timezone',p_timezone),
   'suppressionThreshold',5,'activeUserDefinition','A user who completed an assessment or wellness activity in the selected local date range.',
   'overview',jsonb_build_object('users',(select count(*) from public.profiles),
     'activeUsers',jsonb_build_object('value',(select count(distinct user_id) from events),'suppressed',false),
     'assessments',jsonb_build_object('value',(select count(*) from events where kind='assessment'),'suppressed',false),
     'activities',jsonb_build_object('value',(select count(*) from events where kind='activity'),'suppressed',false),
     'publishedArticles',(select count(*) from public.articles where status='PUBLISHED'),
     'activeActivities',(select count(*) from public.wellness_activities where is_active)),
   'users',public.suppress_analytics_buckets((select jsonb_agg(jsonb_build_object('label',d::date,'count',coalesce(n,0),'actors',coalesce(n,0)) order by d)
     from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d left join registrations r on r.local_day=d::date)),
   'assessments',public.suppress_analytics_buckets((select jsonb_agg(jsonb_build_object('label',c.category,'count',coalesce(n,0),'actors',coalesce(actors,0)) order by c.category)
     from (values ('EYE_COMFORT'),('POSTURE'),('SLEEP'),('DIGITAL_FATIGUE')) c(category)
     left join usage_counts u on u.kind='assessment' and u.category=c.category)),
   'activities',public.suppress_analytics_buckets((select jsonb_agg(jsonb_build_object('label',c.category,'count',coalesce(n,0),'actors',coalesce(actors,0)) order by c.category)
     from (values ('EYE_COMFORT'),('POSTURE'),('MOVEMENT'),('SLEEP'),('DIGITAL_BREAK'),('GENERAL')) c(category)
     left join usage_counts u on u.kind='activity' and u.category=c.category)),
   'content',(select coalesce(jsonb_agg(jsonb_build_object('label',status,'value',n,'suppressed',false) order by status),'[]')
     from (select status,count(*) n from public.articles group by status) c),
   'engagement',public.suppress_analytics_buckets((select jsonb_agg(jsonb_build_object('label',d::date,'count',coalesce(n,0),'actors',coalesce(actors,0)) order by d)
     from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d left join engagement e on e.local_day=d::date))
 ) into result;
 -- Suppress all behavioral totals when any breakdown is suppressed. No small-group
 -- exact totals remain to reconstruct hidden category or day values.
 private_hidden=exists(select 1 from jsonb_array_elements((result->'assessments')||(result->'activities')||(result->'engagement')) b where (b->>'suppressed')::boolean);
 select count(distinct user_id) into active_n from (
   select user_id from public.assessment_attempts where submitted_at>=lo and submitted_at<hi
   union select user_id from public.activity_sessions where status='COMPLETED' and completed_at>=lo and completed_at<hi) e;
 if private_hidden or (active_n>0 and active_n<5) then
   result=jsonb_set(result,'{overview,activeUsers}','{"value":null,"suppressed":true}');
   result=jsonb_set(result,'{overview,assessments}','{"value":null,"suppressed":true}');
   result=jsonb_set(result,'{overview,activities}','{"value":null,"suppressed":true}');
   -- Suppress linked panels together: an engagement total minus a visible
   -- activity breakdown must not reveal a hidden assessment count. Static
   -- category lists also avoid revealing which category had a small group.
   foreach breakdown in array array['assessments','activities','engagement'] loop
     result=jsonb_set(result,array[breakdown],(select coalesce(jsonb_agg(b||'{"value":null,"suppressed":true}'::jsonb order by ord),'[]')
       from jsonb_array_elements(result->breakdown) with ordinality e(b,ord)));
   end loop;
 end if;
 return result;
end;$$;

revoke all on function public.personal_wellness_analytics(uuid,date,date,text,text,int,int),
 public.dashboard_wellness_summary(uuid,text),public.suppress_analytics_buckets(jsonb),
 public.admin_wellness_analytics(uuid,date,date,text) from public,anon,authenticated;
grant execute on function public.personal_wellness_analytics(uuid,date,date,text,text,int,int),
 public.dashboard_wellness_summary(uuid,text),public.suppress_analytics_buckets(jsonb),
 public.admin_wellness_analytics(uuid,date,date,text) to service_role;
commit;

NOTIFY pgrst, 'reload schema';
