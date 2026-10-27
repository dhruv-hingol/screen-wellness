begin;
create table public.assessment_types(
 id uuid primary key default gen_random_uuid(),title text not null check(length(title) between 3 and 150),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),description text not null,
 category text not null check(category in ('EYE_COMFORT','POSTURE','SLEEP','DIGITAL_FATIGUE')),
 estimated_minutes int not null check(estimated_minutes between 1 and 60),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.assessment_versions(
 id uuid primary key default gen_random_uuid(),assessment_id uuid not null references public.assessment_types(id),
 version_number int not null check(version_number>0),scoring_config jsonb not null,status text not null default 'draft' check(status in ('draft','published','archived')),
 draft_revision int not null default 0,published_at timestamptz,created_at timestamptz not null default now(),
 unique(assessment_id,version_number),unique(id,assessment_id));
create unique index one_published_assessment_version on public.assessment_versions(assessment_id) where status='published';
create unique index one_draft_assessment_version on public.assessment_versions(assessment_id) where status='draft';
create table public.assessment_questions(
 id uuid primary key default gen_random_uuid(),assessment_version_id uuid not null references public.assessment_versions(id),
 question_text text not null check(length(question_text)>0),question_type text not null default 'single_choice' check(question_type='single_choice'),
 is_required boolean not null default true,display_order int not null check(display_order>0),created_at timestamptz not null default now(),
 unique(assessment_version_id,display_order),unique(id,assessment_version_id));
create table public.assessment_options(
 id uuid primary key default gen_random_uuid(),question_id uuid not null references public.assessment_questions(id) on delete cascade,
 option_text text not null check(length(option_text)>0),score int not null check(score between 0 and 100),
 display_order int not null check(display_order>0),unique(question_id,display_order),unique(id,question_id));
create table public.assessment_attempts(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 assessment_id uuid not null references public.assessment_types(id),assessment_version_id uuid not null,
 total_score numeric not null,normalized_score numeric not null check(normalized_score between 0 and 100),
 minimum_score numeric not null,maximum_score numeric not null,feedback_category text not null,explanation text not null,compatibility_key text not null,
 assessment_title text not null,category text not null,version_number int not null,result_snapshot jsonb not null,
 idempotency_key uuid not null,request_hash text not null,submitted_at timestamptz not null default now(),
 foreign key(assessment_version_id,assessment_id) references public.assessment_versions(id,assessment_id),
 unique(user_id,idempotency_key),unique(id,user_id),unique(id,assessment_version_id),
 check(maximum_score>=minimum_score and total_score between minimum_score and maximum_score));
create table public.assessment_responses(
 id uuid primary key default gen_random_uuid(),attempt_id uuid not null,assessment_version_id uuid not null,question_id uuid not null,selected_option_id uuid not null,created_at timestamptz not null default now(),
 foreign key(attempt_id,assessment_version_id) references public.assessment_attempts(id,assessment_version_id) on delete cascade,
 foreign key(question_id,assessment_version_id) references public.assessment_questions(id,assessment_version_id),
 foreign key(selected_option_id,question_id) references public.assessment_options(id,question_id),
 unique(attempt_id,question_id));
create table public.recommendation_rules(
 id uuid primary key default gen_random_uuid(),assessment_id uuid references public.assessment_types(id),
 rule_name text not null,recommendation_title text not null,recommendation_description text not null,recommendation_type text not null,
 conditions jsonb not null,priority int not null check(priority between 1 and 3),is_active boolean not null default true,
 revision int not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.user_recommendations(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 assessment_attempt_id uuid,rule_id uuid not null references public.recommendation_rules(id),rule_revision int not null,
 status text not null default 'active' check(status in ('active','completed','dismissed')),content_snapshot jsonb not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(assessment_attempt_id,user_id) references public.assessment_attempts(id,user_id) on delete cascade,
 unique(user_id,rule_id,rule_revision));
create index attempts_owner_date on public.assessment_attempts(user_id,submitted_at desc,id);
create index attempts_assessment on public.assessment_attempts(assessment_id,assessment_version_id);
create index responses_question on public.assessment_responses(question_id);
create index responses_option on public.assessment_responses(selected_option_id);
create index recommendations_owner_status on public.user_recommendations(user_id,status,created_at desc);
create index recommendations_attempt on public.user_recommendations(assessment_attempt_id);
create index recommendations_rule on public.user_recommendations(rule_id);
create index rules_assessment on public.recommendation_rules(assessment_id) where is_active;
create trigger assessment_types_updated before update on public.assessment_types for each row execute function public.set_updated_at();
create trigger recommendation_rules_updated before update on public.recommendation_rules for each row execute function public.set_updated_at();
create trigger user_recommendations_updated before update on public.user_recommendations for each row execute function public.set_updated_at();

create function public.guard_assessment_definition() returns trigger language plpgsql set search_path='' as $$
declare version_id uuid; parent_status text;
begin
 if tg_table_name='assessment_versions' then
  if old.status<>'draft' and (tg_op='DELETE' or new.scoring_config is distinct from old.scoring_config or new.assessment_id<>old.assessment_id or new.version_number<>old.version_number or new.status='draft') then raise exception 'Published versions are immutable';end if;
 else
  if tg_table_name='assessment_questions' then
   if tg_op='DELETE' then version_id=old.assessment_version_id;else version_id=new.assessment_version_id;end if;
   if tg_op='UPDATE' and old.assessment_version_id<>new.assessment_version_id then raise exception 'Question ownership is immutable';end if;
  else
   if tg_op='DELETE' then select assessment_version_id into version_id from public.assessment_questions where id=old.question_id;
   else select assessment_version_id into version_id from public.assessment_questions where id=new.question_id;end if;
   if tg_op='UPDATE' and old.question_id<>new.question_id then raise exception 'Option ownership is immutable';end if;
  end if;
  select status into parent_status from public.assessment_versions where id=version_id for share;
  if parent_status is distinct from 'draft' then raise exception 'Published questions and options are immutable';end if;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
create trigger versions_immutable before update or delete on public.assessment_versions for each row execute function public.guard_assessment_definition();
create trigger questions_immutable before insert or update or delete on public.assessment_questions for each row execute function public.guard_assessment_definition();
create trigger options_immutable before insert or update or delete on public.assessment_options for each row execute function public.guard_assessment_definition();
create function public.guard_assessment_history() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Assessment history is immutable';end;$$;
create trigger attempts_immutable before update on public.assessment_attempts for each row execute function public.guard_assessment_history();
create trigger responses_immutable before update on public.assessment_responses for each row execute function public.guard_assessment_history();
create function public.rule_revision() returns trigger language plpgsql set search_path='' as $$
begin new.revision=old.revision+1;return new;end;$$;
create trigger rule_revision before update on public.recommendation_rules for each row execute function public.rule_revision();
-- RLS deliberately grants read only; validated writes are through owner-bound Express services.
alter table public.assessment_types enable row level security;
alter table public.assessment_versions enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_options enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.recommendation_rules enable row level security;
alter table public.user_recommendations enable row level security;
revoke all on public.assessment_types,public.assessment_versions,public.assessment_questions,public.assessment_options,public.assessment_attempts,public.assessment_responses,public.recommendation_rules,public.user_recommendations from anon,authenticated;
grant all on public.assessment_types,public.assessment_versions,public.assessment_questions,public.assessment_options,public.assessment_attempts,public.assessment_responses,public.recommendation_rules,public.user_recommendations to service_role;
grant select on public.assessment_types,public.assessment_questions,public.assessment_attempts,public.assessment_responses,public.user_recommendations to authenticated;
grant select(id,assessment_id,version_number,status,published_at,created_at) on public.assessment_versions to authenticated;
grant select(id,question_id,option_text,display_order) on public.assessment_options to authenticated;
create policy assessment_types_published on public.assessment_types for select to authenticated using(status='published');
create policy versions_published on public.assessment_versions for select to authenticated using(status='published' and exists(select 1 from public.assessment_types t where t.id=assessment_id and t.status='published'));
create policy questions_published on public.assessment_questions for select to authenticated using(exists(select 1 from public.assessment_versions v where v.id=assessment_version_id and v.status='published'));
create policy options_published on public.assessment_options for select to authenticated using(exists(select 1 from public.assessment_questions q where q.id=question_id));
create policy attempts_owner on public.assessment_attempts for select to authenticated using(user_id=(select auth.uid()));
create policy responses_owner on public.assessment_responses for select to authenticated using(exists(select 1 from public.assessment_attempts a where a.id=attempt_id and a.user_id=(select auth.uid())));
create policy recommendations_owner on public.user_recommendations for select to authenticated using(user_id=(select auth.uid()));

create function public.save_assessment_draft(p_assessment_id uuid,p_version_id uuid,p_revision int,p_definition jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v public.assessment_versions; q jsonb; o jsonb; qi int=0; oi int;
begin
 select * into v from public.assessment_versions where id=p_version_id and assessment_id=p_assessment_id for update;
 if not found or v.status<>'draft' or v.draft_revision<>p_revision then raise exception using errcode='40001',message='Draft changed; reload before saving';end if;
 delete from public.assessment_options where question_id in(select id from public.assessment_questions where assessment_version_id=v.id);
 delete from public.assessment_questions where assessment_version_id=v.id;
 update public.assessment_versions set scoring_config=p_definition->'scoring_config',draft_revision=draft_revision+1 where id=v.id;
 for q in select value from jsonb_array_elements(p_definition->'questions') loop
  qi=qi+1;
  insert into public.assessment_questions(id,assessment_version_id,question_text,question_type,is_required,display_order)
  values((q->>'id')::uuid,v.id,q->>'question_text','single_choice',(q->>'is_required')::boolean,qi);
  oi=0;
  for o in select value from jsonb_array_elements(q->'options') loop
   oi=oi+1;
   insert into public.assessment_options(id,question_id,option_text,score,display_order) values((o->>'id')::uuid,(q->>'id')::uuid,o->>'option_text',(o->>'score')::int,oi);
  end loop;
 end loop;
end;$$;
create function public.publish_assessment(p_assessment_id uuid,p_version_id uuid,p_revision int)
returns void language plpgsql security definer set search_path='' as $$
declare v public.assessment_versions;
begin
 perform 1 from public.assessment_types where id=p_assessment_id for update;
 select * into v from public.assessment_versions where id=p_version_id and assessment_id=p_assessment_id for update;
 if not found or v.status<>'draft' or v.draft_revision<>p_revision then raise exception using errcode='40001',message='Draft changed; reload before publishing';end if;
 if not exists(select 1 from public.assessment_questions where assessment_version_id=v.id and is_required) or exists(select 1 from public.assessment_questions q where q.assessment_version_id=v.id and (select count(*) from public.assessment_options o where o.question_id=q.id)<2) then raise exception 'Invalid questionnaire';end if;
 update public.assessment_versions set status='archived' where assessment_id=p_assessment_id and status='published';
 update public.assessment_versions set status='published',published_at=now() where id=v.id;
 update public.assessment_types set status='published' where id=p_assessment_id;
end;$$;
create function public.store_assessment_submission(p_user_id uuid,p_assessment_id uuid,p_version_id uuid,p_key uuid,p_hash text,p_result jsonb,p_responses jsonb,p_recommendations jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.assessment_attempts; v public.assessment_versions; t public.assessment_types; attempt_id uuid=gen_random_uuid(); r jsonb;
begin
 perform 1 from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Profile not found';end if;
 select * into existing from public.assessment_attempts where user_id=p_user_id and idempotency_key=p_key;
 if found then if existing.request_hash<>p_hash then raise exception using errcode='40001',message='Idempotency key reused with different responses';end if;return existing.id;end if;
 select * into t from public.assessment_types where id=p_assessment_id for share;
 select * into v from public.assessment_versions where id=p_version_id and assessment_id=p_assessment_id for share;
 if v.id is null or v.status<>'published' or t.status<>'published' then raise exception using errcode='40001',message='Assessment no longer available';end if;
 if exists(select 1 from public.assessment_questions q where q.assessment_version_id=v.id and q.is_required and not exists(select 1 from jsonb_array_elements(p_responses) submitted_response(answer) where (submitted_response.answer->>'questionId')::uuid=q.id)) then raise exception 'Missing required response';end if;
 insert into public.assessment_attempts(id,user_id,assessment_id,assessment_version_id,total_score,normalized_score,minimum_score,maximum_score,feedback_category,explanation,compatibility_key,assessment_title,category,version_number,result_snapshot,idempotency_key,request_hash)
 values(attempt_id,p_user_id,t.id,v.id,(p_result->>'total_score')::numeric,(p_result->>'normalized_score')::numeric,(p_result->>'minimum_score')::numeric,(p_result->>'maximum_score')::numeric,p_result->>'feedback_category',p_result->>'explanation',p_result->>'compatibility_key',t.title,t.category,v.version_number,p_result->'result_snapshot',p_key,p_hash);
 for r in select value from jsonb_array_elements(p_responses) loop
  insert into public.assessment_responses(attempt_id,assessment_version_id,question_id,selected_option_id) values(attempt_id,v.id,(r->>'questionId')::uuid,(r->>'selectedOptionId')::uuid);
 end loop;
 for r in select value from jsonb_array_elements(p_recommendations) loop
  insert into public.user_recommendations(user_id,assessment_attempt_id,rule_id,rule_revision,content_snapshot)
  values(p_user_id,attempt_id,(r->>'rule_id')::uuid,(r->>'rule_revision')::int,r) on conflict(user_id,rule_id,rule_revision) do nothing;
 end loop;
 return attempt_id;
end;$$;
create function public.start_assessment_draft(p_assessment_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; n int;
begin
 perform 1 from public.assessment_types where id=p_assessment_id for update;
 if not found then raise exception 'Assessment not found';end if;
 select id into result from public.assessment_versions where assessment_id=p_assessment_id and status='draft';
 if found then return result;end if;
 select coalesce(max(version_number),0)+1 into n from public.assessment_versions where assessment_id=p_assessment_id;
 insert into public.assessment_versions(assessment_id,version_number,scoring_config) values(p_assessment_id,n,'{"compatibilityKey":"computed-on-publication","bands":[{"min":0,"label":"Lower reported concern","explanation":"Your answers describe fewer concerns. Reflect on habits that support you."},{"min":34,"label":"Moderate reported concern","explanation":"Your answers describe some concerns. Consider small manageable changes."},{"min":67,"label":"Higher reported concern","explanation":"Your answers describe more frequent concerns. Review supportive habits and consider qualified advice for persistent discomfort."}]}') returning id into result;
 return result;
end;$$;
revoke all on function public.save_assessment_draft(uuid,uuid,int,jsonb),public.publish_assessment(uuid,uuid,int),public.store_assessment_submission(uuid,uuid,uuid,uuid,text,jsonb,jsonb,jsonb),public.start_assessment_draft(uuid) from public,anon,authenticated;
grant execute on function public.save_assessment_draft(uuid,uuid,int,jsonb),public.publish_assessment(uuid,uuid,int),public.store_assessment_submission(uuid,uuid,uuid,uuid,text,jsonb,jsonb,jsonb),public.start_assessment_draft(uuid) to service_role;
commit;
