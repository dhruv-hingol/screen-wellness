begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',false,2097152,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/webp'];
-- Only owner reads. Client uploads/deletes have no policy: all uploads pass
-- server validation and image decoding/re-encoding before privileged storage access.
create policy screenwise_avatar_owner_read on storage.objects
for select to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
