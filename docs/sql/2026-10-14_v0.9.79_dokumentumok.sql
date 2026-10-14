-- Pontregiszter v0.9.79: Dokumentumok fül — bemutatkozó lap és egyesületi igazolás (Sándor 2026.10.14)
--   - competitor_documents: a mentett dokumentumok (beállítások + a szülő szövege), újra legenerálhatók
--   - competitor_doc_extras: edzői ajánlás (magyar/angol) és „Válogatott kerettag” jelölés — csak edző írja
--   - document-photos: privát tárhely, dokumentumonként legfeljebb 1 fotó
-- Készíti: a szülő (a saját gyerekének) és az edzők (bárkinek). A gyerek látja. Más szülő nem.
-- Futtatás: Supabase → SQL Editor → Run. Többször is lefuttatható; meglévő adatot nem módosít.

-- Szülő-e (a szülő-admin is) az adott gyereknél
create or replace function public.is_parent_of(p_competitor uuid) returns boolean
language sql stable security definer set search_path = public as $f$
  select exists (select 1 from parent_child_links
                 where parent_user_id = auth.uid() and competitor_id = p_competitor)
$f$;
revoke all on function public.is_parent_of(uuid) from public, anon;
grant execute on function public.is_parent_of(uuid) to authenticated;

create table if not exists public.competitor_documents (
  id            uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  kind          text not null default 'bemutatkozo' check (kind in ('bemutatkozo','igazolas')),
  lang          text not null default 'hu' check (lang in ('hu','en')),
  title         text not null check (char_length(btrim(title)) between 1 and 200),
  audience      text not null default 'egyeb' check (audience in ('tamogato','felveteli','valogatott','egyeb')),
  recipient     text check (char_length(recipient) <= 300),
  body          text check (char_length(body) <= 6000),
  settings      jsonb not null default '{}'::jsonb,
  photo_path    text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists competitor_documents_competitor_idx on public.competitor_documents (competitor_id);

create table if not exists public.competitor_doc_extras (
  competitor_id     uuid primary key references public.competitors(id) on delete cascade,
  recommendation_hu text check (char_length(recommendation_hu) <= 3000),
  recommendation_en text check (char_length(recommendation_en) <= 3000),
  valogatott        boolean not null default false,
  valogatott_text   text check (char_length(valogatott_text) <= 300),
  updated_by        uuid default auth.uid(),
  updated_at        timestamptz not null default now()
);

alter table public.competitor_documents  enable row level security;
alter table public.competitor_doc_extras enable row level security;

-- Dokumentumok: olvas az edző, a gyerek és a szülője; ír az edző és a szülő
drop policy if exists competitor_documents_read on public.competitor_documents;
create policy competitor_documents_read on public.competitor_documents for select to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo'])
         or public.can_report_training_for(competitor_id));
drop policy if exists competitor_documents_write on public.competitor_documents;
create policy competitor_documents_write on public.competitor_documents for all to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo'])
         or public.is_parent_of(competitor_id))
  with check (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo'])
              or public.is_parent_of(competitor_id));

-- Edzői ajánlás + válogatott: olvas az edző, a gyerek, a szülő; ír CSAK az edző
drop policy if exists competitor_doc_extras_read on public.competitor_doc_extras;
create policy competitor_doc_extras_read on public.competitor_doc_extras for select to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo'])
         or public.can_report_training_for(competitor_id));
drop policy if exists competitor_doc_extras_write on public.competitor_doc_extras;
create policy competitor_doc_extras_write on public.competitor_doc_extras for all to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']))
  with check (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));

grant select, insert, update, delete on public.competitor_documents, public.competitor_doc_extras to authenticated;
revoke all on public.competitor_documents, public.competitor_doc_extras from anon;

-- Fotótárhely: <competitor_id>/<fájl>.jpg, max 3 MB, csak kép
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('document-photos', 'document-photos', false, 3145728, array['image/jpeg','image/webp','image/png'])
on conflict (id) do nothing;

drop policy if exists "document photos read" on storage.objects;
create policy "document photos read" on storage.objects for select to authenticated
  using (bucket_id = 'document-photos'
         and (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo'])
              or public.can_report_training_for(((storage.foldername(name))[1])::uuid)));
drop policy if exists "document photos insert" on storage.objects;
create policy "document photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'document-photos'
              and (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo'])
                   or public.is_parent_of(((storage.foldername(name))[1])::uuid)));
drop policy if exists "document photos delete" on storage.objects;
create policy "document photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'document-photos'
         and (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo'])
              or public.is_parent_of(((storage.foldername(name))[1])::uuid)));
