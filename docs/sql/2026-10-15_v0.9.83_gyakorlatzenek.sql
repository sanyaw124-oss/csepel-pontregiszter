-- Pontregiszter v0.9.83: gyakorlatzenék (Kata + Sándor, 2026.10.15)
--   Az edző gyerekenként és szerenként egy zenét tölt fel (új feltöltés = a régi törlődik).
--   Látja és letölti: a gyerek, a szülője és az edzők. Csapatgyakorlathoz nincs zene.
--   Feltölt / töröl: Admin, Szülő-admin, Vezetőedző, Edző.
-- Futtatás: Supabase → SQL Editor → Run. Többször is lefuttatható; meglévő adatot nem módosít.

create table if not exists public.competitor_music (
  id            uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  apparatus     text not null check (apparatus in ('szabad','karika','labda','buzogany','szalag','kotel')),
  file_path     text not null,
  original_name text,
  size_bytes    bigint,
  uploaded_by   uuid default auth.uid(),
  uploaded_at   timestamptz not null default now(),
  unique (competitor_id, apparatus)
);

alter table public.competitor_music enable row level security;
drop policy if exists competitor_music_read on public.competitor_music;
create policy competitor_music_read on public.competitor_music for select to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo'])
         or public.can_report_training_for(competitor_id));
drop policy if exists competitor_music_write on public.competitor_music;
create policy competitor_music_write on public.competitor_music for all to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']))
  with check (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));
grant select, insert, update, delete on public.competitor_music to authenticated;
revoke all on public.competitor_music from anon;

-- Zenetárhely: <competitor_id>/<szer>_<idő>.<kiterjesztés>, max 15 MB, csak hang
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('music', 'music', false, 15728640,
        array['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/aac','audio/wav','audio/x-wav','audio/wave'])
on conflict (id) do nothing;

drop policy if exists "music read" on storage.objects;
create policy "music read" on storage.objects for select to authenticated
  using (bucket_id = 'music'
         and (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo'])
              or public.can_report_training_for(((storage.foldername(name))[1])::uuid)));
drop policy if exists "music insert" on storage.objects;
create policy "music insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'music' and current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));
drop policy if exists "music delete" on storage.objects;
create policy "music delete" on storage.objects for delete to authenticated
  using (bucket_id = 'music' and current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));
