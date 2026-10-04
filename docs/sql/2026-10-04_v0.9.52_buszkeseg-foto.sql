-- Pontregiszter v0.9.52: klub büszkesége — fotó (csak bővítés; meglévő adatot nem módosít)
-- Futtatás: Supabase → SQL Editor → beilleszt → Run. Többször is lefuttatható.

-- 1) A bejegyzés fotójának helye (a club-photos tárhelyen belüli útvonal)
alter table public.club_pride add column if not exists photo_path text;

-- 2) Privát fotótárhely: max 3 MB, csak kép; olvasás bejelentkezve,
--    feltöltés / törlés csak Admin, Szülő-admin, Vezetőedző, Edző
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-photos', 'club-photos', false, 3145728, array['image/jpeg','image/webp','image/png'])
on conflict (id) do nothing;

drop policy if exists "club photos read logged in" on storage.objects;
create policy "club photos read logged in" on storage.objects
  for select to authenticated using (bucket_id = 'club-photos');
drop policy if exists "club photos staff insert" on storage.objects;
create policy "club photos staff insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'club-photos'
              and current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));
drop policy if exists "club photos staff delete" on storage.objects;
create policy "club photos staff delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'club-photos'
         and current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));
