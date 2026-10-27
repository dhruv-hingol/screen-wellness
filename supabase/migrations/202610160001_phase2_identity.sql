begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '' check (char_length(full_name)<=100),
 email text not null,
 role text not null default 'USER' check(role in ('USER','ADMIN')),
 avatar_url text,
 occupation text check(occupation in ('Student','Working Professional','Other')),
 onboarding_completed boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.user_preferences (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references public.profiles(id) on delete cascade,
 age_range text check(age_range in ('Under 18','18-24','25-34','35-44','45+')),
 primary_device text check(primary_device in ('Smartphone','Laptop','Desktop','Tablet','Other')),
 daily_screen_hours numeric check(daily_screen_hours between 0 and 24),
 usage_purpose text check(usage_purpose in ('Study','Work','Entertainment','Social connection','Mixed')),
 sleep_time time, wake_time time,
 break_frequency text check(break_frequency in ('Every 20 minutes','Every hour','Every few hours','Rarely')),
 theme text not null default 'system' check(theme in ('system','light','dark')),
 notifications_enabled boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.user_wellness_goals (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 goal_key text not null check(goal_key in ('eye_comfort','posture','sleep','screen_breaks','digital_fatigue','overall_wellness')),
 created_at timestamptz not null default now(),
 unique(user_id,goal_key)
);
-- UNIQUE(user_id) and UNIQUE(user_id,goal_key) already index owner lookups.
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_wellness_goals enable row level security;
revoke all on public.profiles,public.user_preferences,public.user_wellness_goals from anon,authenticated;
grant select on public.profiles,public.user_preferences,public.user_wellness_goals to authenticated;
grant all on public.profiles,public.user_preferences,public.user_wellness_goals to service_role;
create policy profiles_owner_read on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy preferences_owner_read on public.user_preferences for select to authenticated using ((select auth.uid())=user_id);
create policy goals_owner_read on public.user_wellness_goals for select to authenticated using ((select auth.uid())=user_id);
-- Writes intentionally go through authenticated Express services with allowlisted
-- fields and an identity-derived owner filter. No browser may write role/email/status.
create function public.set_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now();return new;end;$$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger preferences_updated before update on public.user_preferences for each row execute function public.set_updated_at();
create function public.initialize_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,full_name,email,role) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),100),coalesce(new.email,''),'USER');
 insert into public.user_preferences(user_id) values(new.id);
 return new;
end;$$;
revoke all on function public.initialize_user() from public,anon,authenticated;
create trigger screenwise_auth_user_created after insert on auth.users for each row execute function public.initialize_user();
create function public.sync_profile_email() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.profiles set email=coalesce(new.email,'') where id=new.id;return new;end;$$;
revoke all on function public.sync_profile_email() from public,anon,authenticated;
create trigger screenwise_auth_email_updated after update of email on auth.users for each row execute function public.sync_profile_email();
-- Existing Auth identities are initialized too; never derive roles from metadata.
insert into public.profiles(id,full_name,email,role)
 select id,left(coalesce(raw_user_meta_data->>'full_name',''),100),coalesce(email,''),'USER' from auth.users on conflict(id) do nothing;
insert into public.user_preferences(user_id) select id from public.profiles on conflict(user_id) do nothing;
create function public.replace_wellness_goals(p_user_id uuid,p_goals text[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Profile not found';end if;
 if p_goals is null or cardinality(p_goals)>6 then raise exception 'Invalid goals';end if;
 delete from public.user_wellness_goals where user_id=p_user_id;
 insert into public.user_wellness_goals(user_id,goal_key) select p_user_id,g from (select distinct unnest(p_goals) g) choices;
end;$$;
revoke all on function public.replace_wellness_goals(uuid,text[]) from public,anon,authenticated;
grant execute on function public.replace_wellness_goals(uuid,text[]) to service_role;
create function public.complete_onboarding(p_user_id uuid,p_answers jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare selected_goals text[];
begin
 perform 1 from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Profile not found';end if;
 if length(trim(coalesce(p_answers->>'full_name','')))<2
 or p_answers->>'occupation' is null or p_answers->>'primary_device' is null
 or p_answers->>'daily_screen_hours' is null or p_answers->>'usage_purpose' is null
 or p_answers->>'break_frequency' is null
 or jsonb_typeof(p_answers->'goals') is distinct from 'array'
 then raise exception 'Incomplete onboarding';end if;
 select array_agg(value) into selected_goals from jsonb_array_elements_text(p_answers->'goals');
 if coalesce(cardinality(selected_goals),0)=0 then raise exception 'Choose at least one goal';end if;
 update public.profiles set full_name=trim(p_answers->>'full_name'),occupation=p_answers->>'occupation' where id=p_user_id;
 update public.user_preferences set age_range=p_answers->>'age_range',primary_device=p_answers->>'primary_device',
 daily_screen_hours=(p_answers->>'daily_screen_hours')::numeric,usage_purpose=p_answers->>'usage_purpose',
 break_frequency=p_answers->>'break_frequency',sleep_time=(p_answers->>'sleep_time')::time,wake_time=(p_answers->>'wake_time')::time where user_id=p_user_id;
 if not found then raise exception 'Preferences not found';end if;
 perform public.replace_wellness_goals(p_user_id,selected_goals);
 update public.profiles set onboarding_completed=true where id=p_user_id;
end;$$;
revoke all on function public.complete_onboarding(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.complete_onboarding(uuid,jsonb) to service_role;
commit;
