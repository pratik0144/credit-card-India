-- =====================================================================
-- 20260703000006_storage.sql
-- Storage buckets (§11): card-images + author-headshots.
-- Public read, service-role write only — no direct client uploads (v1).
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('author-headshots', 'author-headshots', true)
on conflict (id) do update set public = excluded.public;

-- Public read for both buckets.
create policy "card_images_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'card-images');

create policy "author_headshots_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'author-headshots');

-- Service-role write only (insert/update/delete). No anon/authenticated write
-- policy => uploads are impossible for those roles (§11: no UGC in v1).
create policy "card_images_service_write" on storage.objects
  for all to service_role
  using (bucket_id = 'card-images')
  with check (bucket_id = 'card-images');

create policy "author_headshots_service_write" on storage.objects
  for all to service_role
  using (bucket_id = 'author-headshots')
  with check (bucket_id = 'author-headshots');
