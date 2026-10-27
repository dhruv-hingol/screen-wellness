begin;
alter table public.user_preferences add column if not exists timezone text not null default 'Asia/Kolkata';
create table public.wellness_activities(
 id uuid primary key default gen_random_uuid(),title text not null,slug text not null unique,description text not null,
 category text not null check(category in ('EYE_COMFORT','POSTURE','MOVEMENT','SLEEP','DIGITAL_BREAK','GENERAL')),
 duration_seconds int not null check(duration_seconds between 5 and 7200),instructions jsonb not null check(jsonb_typeof(instructions)='array' and jsonb_array_length(instructions)>0),benefits jsonb not null default '[]' check(jsonb_typeof(benefits)='array'),
 safety_notes text,icon text,image_url text,difficulty text not null check(difficulty in ('EASY','MODERATE')),is_active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.activity_sessions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 activity_id uuid not null references public.wellness_activities(id),started_at timestamptz not null default now(),completed_at timestamptz,duration_seconds int check(duration_seconds>=0),
 status text not null default 'STARTED' check(status in ('STARTED','COMPLETED','CANCELLED')),created_at timestamptz not null default now(),
 source text not null check(source in ('MANUAL','CHECKLIST','TIMER')),idempotency_key uuid not null,activity_snapshot jsonb not null,checklist_date date,
 unique(user_id,idempotency_key),check((status='COMPLETED' and completed_at is not null and duration_seconds is not null) or (status<>'COMPLETED' and completed_at is null)));
create unique index one_checklist_completion on public.activity_sessions(user_id,activity_id,checklist_date) where source='CHECKLIST' and status<>'CANCELLED';
create unique index one_active_timer_session on public.activity_sessions(user_id) where source='TIMER' and status='STARTED';
create index sessions_owner_completed on public.activity_sessions(user_id,completed_at desc);
create index sessions_activity on public.activity_sessions(activity_id);
create table public.wellness_goals(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null,description text,category text not null check(category in ('EYE_COMFORT','POSTURE','MOVEMENT','SLEEP','DIGITAL_BREAK','GENERAL')),
 target_count int not null check(target_count between 1 and 100),period text not null check(period in ('DAILY','WEEKLY')),
 start_date date not null,end_date date,timezone text not null,tracking_start date not null,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','PAUSED','ARCHIVED')),pause_ranges jsonb not null default '[]',definition_history jsonb not null default '[]',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(end_date is null or end_date>=start_date));
create index goals_owner_status on public.wellness_goals(user_id,status);
create table public.goal_activity_links(id uuid primary key default gen_random_uuid(),goal_id uuid not null references public.wellness_goals(id) on delete cascade,activity_id uuid not null references public.wellness_activities(id),unique(goal_id,activity_id));
create index goal_links_activity on public.goal_activity_links(activity_id);
create table public.reminder_settings(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 reminder_type text not null check(reminder_type in ('EYE_BREAK','POSTURE','MOVEMENT','DAILY_GOAL','EVENING_ROUTINE')),
 interval_minutes int check(interval_minutes between 5 and 240),enabled boolean not null default false,
 start_time time not null,end_time time not null,days_of_week int[] not null,timezone text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(user_id,reminder_type),check(end_time>start_time),check(cardinality(days_of_week) between 1 and 7 and days_of_week <@ array[0,1,2,3,4,5,6]),
 check(reminder_type='EVENING_ROUTINE' or interval_minutes is not null));
create table public.notifications(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 reminder_id uuid references public.reminder_settings(id) on delete set null,title text not null,message text not null,
 type text not null check(type in ('BREAK_REMINDER','ACTIVITY_REMINDER','GOAL_REMINDER','WELLNESS_TIP','SYSTEM')),
 is_read boolean not null default false,scheduled_for timestamptz,created_at timestamptz not null default now(),dedupe_key text not null,unique(user_id,dedupe_key));
create index notification_owner_date on public.notifications(user_id,created_at desc);
create index notification_unread on public.notifications(user_id) where is_read=false;
create index notification_reminder on public.notifications(reminder_id);
alter table public.recommendation_rules add column activity_id uuid references public.wellness_activities(id);
create index rules_activity on public.recommendation_rules(activity_id) where activity_id is not null;
create trigger activities_updated before update on public.wellness_activities for each row execute function public.set_updated_at();
create trigger goals_updated before update on public.wellness_goals for each row execute function public.set_updated_at();
create trigger reminders_updated before update on public.reminder_settings for each row execute function public.set_updated_at();
alter table public.wellness_activities enable row level security;
alter table public.activity_sessions enable row level security;
alter table public.wellness_goals enable row level security;
alter table public.goal_activity_links enable row level security;
alter table public.reminder_settings enable row level security;
alter table public.notifications enable row level security;
revoke all on public.wellness_activities,public.activity_sessions,public.wellness_goals,public.goal_activity_links,public.reminder_settings,public.notifications from anon,authenticated;
grant select on public.wellness_activities,public.activity_sessions,public.wellness_goals,public.goal_activity_links,public.reminder_settings,public.notifications to authenticated;
grant all on public.wellness_activities,public.activity_sessions,public.wellness_goals,public.goal_activity_links,public.reminder_settings,public.notifications to service_role;
create policy activities_active on public.wellness_activities for select to authenticated using(is_active);
create policy sessions_owner on public.activity_sessions for select to authenticated using(user_id=(select auth.uid()));
create policy goals_owner on public.wellness_goals for select to authenticated using(user_id=(select auth.uid()));
create policy goal_links_owner on public.goal_activity_links for select to authenticated using(exists(select 1 from public.wellness_goals g where g.id=goal_id and g.user_id=(select auth.uid())));
create policy reminders_owner on public.reminder_settings for select to authenticated using(user_id=(select auth.uid()));
create policy notifications_owner on public.notifications for select to authenticated using(user_id=(select auth.uid()));

create function public.start_activity_session(p_user_id uuid,p_activity_id uuid,p_key uuid,p_source text) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.wellness_activities;existing public.activity_sessions;zone text;day date;new_id uuid;
begin
 perform 1 from public.profiles where id=p_user_id for update;if not found then raise exception 'Profile not found';end if;
 select * into existing from public.activity_sessions where user_id=p_user_id and idempotency_key=p_key;
 if found then if existing.activity_id<>p_activity_id or existing.source<>p_source then raise exception using errcode='40001',message='Session key already used';end if;return existing.id;end if;
 select * into a from public.wellness_activities where id=p_activity_id and is_active for share;if not found then raise exception using errcode='P0002',message='Activity unavailable';end if;
 select timezone into zone from public.user_preferences where user_id=p_user_id;day=(now() at time zone zone)::date;
 if p_source='TIMER' then
  if a.category<>'EYE_COMFORT' then raise exception 'Visual timer requires an eye-comfort activity';end if;
  select * into existing from public.activity_sessions where user_id=p_user_id and source='TIMER' and status='STARTED';
  if found then return existing.id;end if;
 end if;
 if p_source='CHECKLIST' then
  select * into existing from public.activity_sessions where user_id=p_user_id and activity_id=p_activity_id and source='CHECKLIST' and checklist_date=day and status<>'CANCELLED';
  if found then return existing.id;end if;
 end if;
 insert into public.activity_sessions(user_id,activity_id,idempotency_key,source,activity_snapshot,checklist_date)
 values(p_user_id,p_activity_id,p_key,p_source,to_jsonb(a),case when p_source='CHECKLIST' then day else null end) returning id into new_id;return new_id;
end;$$;
create function public.finish_activity_session(p_user_id uuid,p_session_id uuid,p_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.activity_sessions;elapsed int;
begin
 if p_status not in ('COMPLETED','CANCELLED') then raise exception 'Invalid status';end if;
 select * into s from public.activity_sessions where id=p_session_id and user_id=p_user_id for update;
 if not found then raise exception using errcode='P0002',message='Session not found';end if;
 if s.status=p_status then return s.id;end if;
 if s.status<>'STARTED' then raise exception using errcode='40001',message='Session already ended';end if;
 if p_status='COMPLETED' and now()-s.started_at>interval '24 hours' then raise exception using errcode='40001',message='Session expired; cancel and start again';end if;
 elapsed=greatest(0,least(14400,floor(extract(epoch from now()-s.started_at))::int));
 update public.activity_sessions set status=p_status,completed_at=case when p_status='COMPLETED' then now() else null end,duration_seconds=case when p_status='COMPLETED' then elapsed else null end where id=s.id;return s.id;
end;$$;

create function public.save_wellness_goal(p_user_id uuid,p_goal_id uuid,p_definition jsonb,p_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare g public.wellness_goals;new_id uuid;local_day date;aid text;links jsonb;metric_changed boolean;
begin
 perform 1 from public.profiles where id=p_user_id for update;if not found then raise exception 'Profile not found';end if;
 if p_goal_id is not null then
  select * into g from public.wellness_goals where id=p_goal_id and user_id=p_user_id for update;
  if not found then raise exception using errcode='P0002',message='Goal not found';end if;new_id=g.id;
 end if;
 if p_definition is not null then
  if jsonb_array_length(p_definition->'activity_ids')<1 then raise exception 'Choose activities';end if;
  for aid in select jsonb_array_elements_text(p_definition->'activity_ids') loop
   perform 1 from public.wellness_activities where id=aid::uuid and is_active and (category=p_definition->>'category' or p_definition->>'category'='GENERAL');
   if not found then raise exception 'Choose active activities in the goal category';end if;
  end loop;
  local_day=(now() at time zone (p_definition->>'timezone'))::date;
  if p_goal_id is null then
   insert into public.wellness_goals(user_id,title,description,category,target_count,period,start_date,end_date,timezone,tracking_start)
   values(p_user_id,p_definition->>'title',p_definition->>'description',p_definition->>'category',(p_definition->>'target_count')::int,p_definition->>'period',(p_definition->>'start_date')::date,(p_definition->>'end_date')::date,p_definition->>'timezone',(p_definition->>'start_date')::date) returning id into new_id;
  else
   if g.status='ARCHIVED' then raise exception using errcode='40001',message='Archived goals are read-only';end if;
   select coalesce(jsonb_agg(activity_id::text order by activity_id),'[]') into links from public.goal_activity_links where goal_id=g.id;
   metric_changed=g.target_count<>(p_definition->>'target_count')::int or g.period<>p_definition->>'period' or g.category<>p_definition->>'category' or g.timezone<>p_definition->>'timezone' or g.start_date<>(p_definition->>'start_date')::date or g.end_date is distinct from (p_definition->>'end_date')::date or links is distinct from (select jsonb_agg(x order by x) from jsonb_array_elements_text(p_definition->'activity_ids') t(x));
   update public.wellness_goals set title=p_definition->>'title',description=p_definition->>'description',category=p_definition->>'category',target_count=(p_definition->>'target_count')::int,period=p_definition->>'period',start_date=(p_definition->>'start_date')::date,end_date=(p_definition->>'end_date')::date,timezone=p_definition->>'timezone',
   definition_history=case when metric_changed then definition_history||jsonb_build_array(to_jsonb(g)||jsonb_build_object('activity_ids',links,'superseded_at',now())) else definition_history end,
   tracking_start=case when metric_changed then greatest(local_day,(p_definition->>'start_date')::date) else tracking_start end,
   pause_ranges=case when metric_changed then case when g.status='PAUSED' then jsonb_build_array(jsonb_build_object('from',local_day,'to',null)) else '[]'::jsonb end else pause_ranges end where id=g.id;
  end if;
  delete from public.goal_activity_links where goal_id=new_id;
  insert into public.goal_activity_links(goal_id,activity_id) select new_id,value::uuid from jsonb_array_elements_text(p_definition->'activity_ids');
 end if;
 if p_status is not null and p_goal_id is not null then
  local_day=(now() at time zone g.timezone)::date;
  if g.status='ARCHIVED' and p_status<>'ARCHIVED' then raise exception using errcode='40001',message='Archived goals cannot be resumed';end if;
  if p_status='PAUSED' and g.status='ACTIVE' then
   update public.wellness_goals set pause_ranges=pause_ranges||jsonb_build_array(jsonb_build_object('from',local_day,'to',null)),status=p_status where id=g.id;
  elsif p_status='ACTIVE' and g.status='PAUSED' then
   update public.wellness_goals set pause_ranges=(select jsonb_agg(case when p->>'to' is null then p||jsonb_build_object('to',local_day) else p end) from jsonb_array_elements(pause_ranges) p),status=p_status where id=g.id;
  else update public.wellness_goals set status=p_status where id=g.id;
  end if;
 end if;
 return new_id;
end;$$;

create function public.insert_active_reminders(p_user_id uuid,p_candidates jsonb) returns setof public.notifications language plpgsql security definer set search_path='' as $$
begin
 return query insert into public.notifications(user_id,reminder_id,title,message,type,scheduled_for,dedupe_key)
 select p_user_id,(c->>'reminder_id')::uuid,c->>'title',c->>'message',c->>'type',now(),c->>'key'
 from jsonb_array_elements(p_candidates) c
 join public.reminder_settings r on r.id=(c->>'reminder_id')::uuid and r.user_id=p_user_id and r.enabled
 join public.user_preferences p on p.user_id=p_user_id and p.notifications_enabled
 on conflict(user_id,dedupe_key) do nothing returning *;
end;$$;
revoke all on function public.start_activity_session(uuid,uuid,uuid,text),public.finish_activity_session(uuid,uuid,text),public.save_wellness_goal(uuid,uuid,jsonb,text),public.insert_active_reminders(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.start_activity_session(uuid,uuid,uuid,text),public.finish_activity_session(uuid,uuid,text),public.save_wellness_goal(uuid,uuid,jsonb,text),public.insert_active_reminders(uuid,jsonb) to service_role;

create table public.daily_wellness_checklists(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 date date not null,timezone text not null,activity_snapshot jsonb not null check(jsonb_typeof(activity_snapshot)='array'),
 created_at timestamptz not null default now(),unique(user_id,date,timezone));
alter table public.daily_wellness_checklists enable row level security;
revoke all on public.daily_wellness_checklists from anon,authenticated;
grant select on public.daily_wellness_checklists to authenticated;
grant all on public.daily_wellness_checklists to service_role;
create policy daily_checklist_owner on public.daily_wellness_checklists for select to authenticated using(user_id=(select auth.uid()));
create function public.ensure_daily_checklist(p_user_id uuid,p_date date,p_timezone text,p_activities jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_date<>(now() at time zone p_timezone)::date then raise exception 'Only today can get a new checklist';end if;
 insert into public.daily_wellness_checklists(user_id,date,timezone,activity_snapshot) values(p_user_id,p_date,p_timezone,p_activities) on conflict(user_id,date,timezone) do nothing;
 select activity_snapshot into result from public.daily_wellness_checklists where user_id=p_user_id and date=p_date and timezone=p_timezone;return result;
end;$$;
revoke all on function public.ensure_daily_checklist(uuid,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.ensure_daily_checklist(uuid,date,text,jsonb) to service_role;

commit;
