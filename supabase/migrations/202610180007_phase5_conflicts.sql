begin;
-- Live acceptance found normal editor/media conflicts retried as transient
-- serialization failures by the hosted PostgREST version. Preserve each existing
-- function definition, signature, grants, and logic; change only that SQLSTATE.
do $$
declare target regprocedure; definition text;
begin
  foreach target in array array[
    'public.save_library_article(uuid,uuid,integer,jsonb)'::regprocedure,
    'public.transition_library_article(uuid,uuid,integer,text)'::regprocedure,
    'public.reserve_article_media_deletion(uuid,uuid)'::regprocedure
  ] loop
    definition=pg_get_functiondef(target);
    execute replace(definition,quote_literal('40001'),quote_literal('PT409'));
  end loop;
end; $$;
create or replace function public.library_conflict_code() returns text language sql stable set search_path='' as $$ select 'PT409'::text; $$;
revoke all on function public.library_conflict_code() from public,anon,authenticated;
grant execute on function public.library_conflict_code() to service_role;
notify pgrst, 'reload schema';
commit;
