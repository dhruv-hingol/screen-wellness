begin;

create function public.is_content_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and role='ADMIN');
$$;
revoke all on function public.is_content_admin() from public,anon;
grant execute on function public.is_content_admin() to authenticated,service_role;

create table public.article_categories (
  id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 2 and 100),
  slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),description text,icon text,
  display_order int not null default 0 check(display_order between 0 and 9999),is_active boolean not null default true,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.article_tags (
  id uuid primary key default gen_random_uuid(),name text not null unique,slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
create table public.article_media (
  id uuid primary key default gen_random_uuid(),path text not null unique check(path ~ '^articles/[0-9a-f-]{36}\.webp$'),
  uploaded_by uuid references public.profiles(id) on delete set null,
  status text not null default 'READY' check(status in ('READY','DELETING')),created_at timestamptz not null default now()
);
create index article_media_uploader on public.article_media(uploaded_by);
create table public.articles (
  id uuid primary key default gen_random_uuid(),title text not null check(length(title) between 3 and 180),
  slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),summary text not null default '' check(length(summary)<=600),
  content jsonb not null check(jsonb_typeof(content)='object' and content->>'type'='doc'),
  cover_image_path text references public.article_media(path),category_id uuid not null references public.article_categories(id),
  author_id uuid references public.profiles(id) on delete set null,author_name text not null default 'ScreenWise editorial team',
  word_count int not null default 0 check(word_count between 0 and 20000),reading_time_minutes int not null default 1 check(reading_time_minutes between 1 and 100),
  status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','ARCHIVED')),is_featured boolean not null default false,
  sources jsonb not null default '[]' check(jsonb_typeof(sources)='array'),editorial_reviewed boolean not null default false,
  published_at timestamptz,revision int not null default 1 check(revision>0),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  search_document tsvector generated always as (to_tsvector('english',title || ' ' || summary)) stored,
  check(status<>'PUBLISHED' or (published_at is not null and length(trim(summary))>0 and word_count>0 and editorial_reviewed and jsonb_array_length(sources)>0))
);
create index articles_search on public.articles using gin(search_document);
create index articles_published_date on public.articles(published_at desc,id) where status='PUBLISHED';
create index articles_category_status on public.articles(category_id,status);
create index articles_author on public.articles(author_id);
create index articles_cover on public.articles(cover_image_path) where cover_image_path is not null;
create table public.article_tag_links (
  article_id uuid not null references public.articles(id) on delete cascade,tag_id uuid not null references public.article_tags(id),primary key(article_id,tag_id)
);
create index tag_links_tag on public.article_tag_links(tag_id,article_id);
create table public.article_media_links (
  article_id uuid not null references public.articles(id) on delete cascade,media_id uuid not null references public.article_media(id),primary key(article_id,media_id)
);
create index media_links_media on public.article_media_links(media_id);
create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,created_at timestamptz not null default now(),unique(user_id,article_id)
);
create index bookmarks_owner_date on public.bookmarks(user_id,created_at desc,id);
create index bookmarks_article on public.bookmarks(article_id);
create trigger article_categories_updated before update on public.article_categories for each row execute function public.set_updated_at();
create trigger articles_updated before update on public.articles for each row execute function public.set_updated_at();
create function public.advance_article_revision() returns trigger language plpgsql set search_path='' as $$
begin new.revision=old.revision+1;return new;end;$$;
create trigger articles_revision before update on public.articles for each row execute function public.advance_article_revision();

alter table public.article_categories enable row level security;
alter table public.article_tags enable row level security;
alter table public.articles enable row level security;
alter table public.article_tag_links enable row level security;
alter table public.article_media enable row level security;
alter table public.article_media_links enable row level security;
alter table public.bookmarks enable row level security;
revoke all on public.article_categories,public.article_tags,public.articles,public.article_tag_links,public.article_media,public.article_media_links,public.bookmarks from anon,authenticated;
grant select on public.article_categories,public.article_tags,public.articles,public.article_tag_links,public.article_media,public.article_media_links,public.bookmarks to authenticated;
grant insert(user_id,article_id),delete on public.bookmarks to authenticated;
grant all on public.article_categories,public.article_tags,public.articles,public.article_tag_links,public.article_media,public.article_media_links,public.bookmarks to service_role;
create policy categories_visible on public.article_categories for select to authenticated using(is_active or public.is_content_admin());
create policy tags_visible on public.article_tags for select to authenticated using(true);
create policy articles_visible on public.articles for select to authenticated using(
  public.is_content_admin() or (status='PUBLISHED' and exists(select 1 from public.article_categories c where c.id=category_id and c.is_active))
);
create policy article_tags_visible on public.article_tag_links for select to authenticated using(exists(select 1 from public.articles a where a.id=article_id));
create policy media_admin_read on public.article_media for select to authenticated using(public.is_content_admin());
create policy media_links_admin_read on public.article_media_links for select to authenticated using(public.is_content_admin());
create policy bookmarks_owner_read on public.bookmarks for select to authenticated using(user_id=(select auth.uid()));
create policy bookmarks_owner_insert on public.bookmarks for insert to authenticated with check(user_id=(select auth.uid()) and exists(
  select 1 from public.articles a join public.article_categories c on c.id=a.category_id where a.id=article_id and a.status='PUBLISHED' and c.is_active
));
create policy bookmarks_owner_delete on public.bookmarks for delete to authenticated using(user_id=(select auth.uid()));

create function public.save_library_article(p_editor uuid,p_id uuid,p_revision int,p_definition jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.articles;new_id uuid;media_path text;media_id uuid;editor_name text;
begin
  select full_name into editor_name from public.profiles where id=p_editor and role='ADMIN';
  if not found then raise exception using errcode='42501',message='Administrator required';end if;
  if p_id is not null then
    select * into a from public.articles where id=p_id for update;
    if not found then raise exception using errcode='P0002',message='Article not found';end if;
    if a.revision is distinct from p_revision then raise exception using errcode='40001',message='Article changed; reload before saving';end if;
    if a.status='ARCHIVED' then raise exception using errcode='40001',message='Restore this article to a draft before editing';end if;
  end if;
  perform 1 from public.article_categories where id=(p_definition->>'category_id')::uuid and is_active for share;
  if not found then raise exception 'Choose an active category';end if;
  if p_definition->>'cover_image_path' is not null and not ((p_definition->'media_paths') ? (p_definition->>'cover_image_path')) then raise exception 'Cover image must be registered in the media references';end if;
  for media_path in select jsonb_array_elements_text(p_definition->'media_paths') loop
    perform 1 from public.article_media where path=media_path and status='READY' for share;
    if not found then raise exception 'Choose an available uploaded image';end if;
  end loop;
  if p_id is null then
    insert into public.articles(title,slug,summary,category_id,content,cover_image_path,author_id,author_name,word_count,reading_time_minutes,sources,is_featured,editorial_reviewed)
    values(p_definition->>'title',p_definition->>'slug',p_definition->>'summary',(p_definition->>'category_id')::uuid,p_definition->'content',p_definition->>'cover_image_path',p_editor,editor_name,(p_definition->>'word_count')::int,(p_definition->>'reading_time_minutes')::int,p_definition->'sources',(p_definition->>'is_featured')::boolean,(p_definition->>'editorial_reviewed')::boolean) returning id into new_id;
  else
    update public.articles set title=p_definition->>'title',slug=p_definition->>'slug',summary=p_definition->>'summary',category_id=(p_definition->>'category_id')::uuid,
      content=p_definition->'content',cover_image_path=p_definition->>'cover_image_path',word_count=(p_definition->>'word_count')::int,reading_time_minutes=(p_definition->>'reading_time_minutes')::int,
      sources=p_definition->'sources',is_featured=(p_definition->>'is_featured')::boolean,editorial_reviewed=(p_definition->>'editorial_reviewed')::boolean where id=p_id;
    new_id=p_id;
  end if;
  delete from public.article_tag_links where article_id=new_id;
  insert into public.article_tag_links(article_id,tag_id) select new_id,value::uuid from jsonb_array_elements_text(p_definition->'tag_ids');
  delete from public.article_media_links where article_id=new_id;
  for media_path in select jsonb_array_elements_text(p_definition->'media_paths') loop
    select id into media_id from public.article_media where path=media_path;
    insert into public.article_media_links(article_id,media_id) values(new_id,media_id) on conflict do nothing;
  end loop;
  return new_id;
end;$$;

create function public.transition_library_article(p_editor uuid,p_id uuid,p_revision int,p_status text) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.articles;
begin
  if not exists(select 1 from public.profiles where id=p_editor and role='ADMIN') then raise exception using errcode='42501',message='Administrator required';end if;
  if p_status not in ('PUBLISHED','DRAFT','ARCHIVED') then raise exception 'Invalid article status';end if;
  select * into a from public.articles where id=p_id for update;
  if not found then raise exception using errcode='P0002',message='Article not found';end if;
  if a.revision is distinct from p_revision then raise exception using errcode='40001',message='Article changed; reload before continuing';end if;
  if p_status='PUBLISHED' then
    if a.status='ARCHIVED' then raise exception 'Restore the article to a draft first';end if;
    perform 1 from public.article_categories where id=a.category_id and is_active for share;
    if not found then raise exception 'Choose an active category';end if;
    if length(trim(a.summary))=0 or a.word_count=0 or not a.editorial_reviewed or jsonb_array_length(a.sources)=0 then raise exception 'Review article content, summary and sources before publishing';end if;
  end if;
  if a.status=p_status then return a.id;end if;
  update public.articles set status=p_status,published_at=case when p_status='PUBLISHED' then now() else published_at end where id=a.id;
  return a.id;
end;$$;

create function public.bookmark_library_article(p_user uuid,p_article uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  perform 1 from public.articles a join public.article_categories c on c.id=a.category_id
    where a.id=p_article and a.status='PUBLISHED' and c.is_active for share of a,c;
  if not found then raise exception using errcode='P0002',message='Published article not found';end if;
  insert into public.bookmarks(user_id,article_id) values(p_user,p_article) on conflict(user_id,article_id) do nothing;
  select id into result from public.bookmarks where user_id=p_user and article_id=p_article;
  return result;
end;$$;

create function public.reserve_article_media_deletion(p_editor uuid,p_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare m public.article_media;
begin
  if not exists(select 1 from public.profiles where id=p_editor and role='ADMIN') then raise exception using errcode='42501',message='Administrator required';end if;
  select * into m from public.article_media where id=p_id for update;
  if not found then raise exception using errcode='P0002',message='Image not found';end if;
  if m.status<>'READY' or exists(select 1 from public.article_media_links where media_id=m.id) or exists(select 1 from public.articles where cover_image_path=m.path) then
    raise exception using errcode='40001',message='This image is in use or already being removed';
  end if;
  update public.article_media set status='DELETING' where id=m.id;
  return m.path;
end;$$;
revoke all on function public.save_library_article(uuid,uuid,int,jsonb),public.transition_library_article(uuid,uuid,int,text),public.bookmark_library_article(uuid,uuid),public.reserve_article_media_deletion(uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_library_article(uuid,uuid,int,jsonb),public.transition_library_article(uuid,uuid,int,text),public.bookmark_library_article(uuid,uuid),public.reserve_article_media_deletion(uuid,uuid) to service_role;

-- Media is intentionally public by URL, including covers on drafts. Browser writes
-- are denied; only the validated, authorized backend upload flow writes objects.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('article-media','article-media',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
do $$ begin
  if not exists(select 1 from storage.buckets where id='article-media' and public and file_size_limit=5242880 and allowed_mime_types @> array['image/jpeg','image/png','image/webp'] and allowed_mime_types <@ array['image/jpeg','image/png','image/webp']) then
    raise exception 'Existing article-media bucket has incompatible settings; review it before applying this migration';
  end if;
end; $$;
create policy article_media_metadata_admin on storage.objects for select to authenticated
using(bucket_id='article-media' and public.is_content_admin());

commit;
