-- Pontregiszter v0.9.50: "nem indult" + profilkép (csak bővítés; meglévő adatot nem módosít)
-- Futtatás: Supabase → SQL Editor → beilleszt → Run. Többször is lefuttatható.

-- 1) Nem indult jelölés a startlistán
alter table public.startlist_entries add column if not exists did_not_start boolean not null default false;

-- 2) Profilkép helye a versenyzőnél (az avatars tárhelyen belüli útvonal)
alter table public.competitors add column if not exists avatar_path text;

-- 3) Elrejtett (cenzúrázott) képek — csak a vezető szerepek írhatják,
--    így a gyerek nem tudja visszakapcsolni a saját képét
create table if not exists public.avatar_rejections (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  avatar_path text not null,
  rejected_by uuid default auth.uid(),
  rejected_at timestamptz not null default now(),
  unique (competitor_id, avatar_path)
);
alter table public.avatar_rejections enable row level security;
drop policy if exists "logged in reads avatar_rejections" on public.avatar_rejections;
create policy "logged in reads avatar_rejections" on public.avatar_rejections
  for select to authenticated using (true);
drop policy if exists "staff writes avatar_rejections" on public.avatar_rejections;
create policy "staff writes avatar_rejections" on public.avatar_rejections
  for all to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']))
  with check (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));

-- 4) A belépett gyerek versenyzője (profiles.competitor_id vagy competitors.linked_user_id)
create or replace function public.my_competitor_id() returns uuid
language sql stable security definer set search_path = public as $f$
  select coalesce(
    (select competitor_id from profiles where id = auth.uid()),
    (select id from competitors where linked_user_id = auth.uid() limit 1))
$f$;

-- 5) Privát képtárhely: max 512 KB, csak kép; olvasás bejelentkezve,
--    feltöltés csak a gyerek saját mappájába (<competitor_id>/...),
--    törlés: a gyerek a sajátját, a vezető szerepek bármelyiket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 524288, array['image/jpeg','image/webp','image/png'])
on conflict (id) do nothing;

drop policy if exists "avatars read logged in" on storage.objects;
create policy "avatars read logged in" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');
drop policy if exists "avatars kid uploads own" on storage.objects;
create policy "avatars kid uploads own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and current_user_role() = 'versenyzo'
              and (storage.foldername(name))[1] = public.my_competitor_id()::text);
drop policy if exists "avatars delete own or staff" on storage.objects;
create policy "avatars delete own or staff" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (
    (storage.foldername(name))[1] = public.my_competitor_id()::text
    or current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo'])));
