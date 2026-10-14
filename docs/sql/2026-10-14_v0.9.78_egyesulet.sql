-- Pontregiszter v0.9.78: Egyesület fül — a klub adatai, rövid bemutatkozás (magyar + angol),
-- vezetőség és edzők titulussal (Elnök, Vezetőedző, Edző, Segédedző).
-- Ezekből töltődik a dokumentumok (bemutatkozó, igazolás) fejléce és aláírás-sora is.
-- Olvassa: minden bejelentkezett felhasználó. Írja: Admin, Szülő-admin, Vezetőedző.
-- Futtatás: Supabase → SQL Editor → Run. Többször is lefuttatható; meglévő adatot nem módosít.

create table if not exists public.club_info (
  id          int primary key default 1 check (id = 1),   -- egyetlen sor
  name        text not null default 'Csepeli RG Club',
  address     text,
  email       text,
  website     text,
  intro_hu    text,
  intro_en    text,
  updated_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);
insert into public.club_info (id) values (1) on conflict (id) do nothing;

create table if not exists public.club_people (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  title       text not null check (title in ('elnok','vezetoedzo','edzo','segededzo')),
  note        text,                                         -- pl. „szakedző”, „koreográfus”
  profile_id  uuid references public.profiles(id) on delete set null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.club_info   enable row level security;
alter table public.club_people enable row level security;

drop policy if exists club_info_read on public.club_info;
create policy club_info_read on public.club_info for select to authenticated using (true);
drop policy if exists club_info_write on public.club_info;
create policy club_info_write on public.club_info for update to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo']))
  with check (current_user_role() = any (array['admin','szulo_admin','vezetoedzo']));

drop policy if exists club_people_read on public.club_people;
create policy club_people_read on public.club_people for select to authenticated using (true);
drop policy if exists club_people_write on public.club_people;
create policy club_people_write on public.club_people for all to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo']))
  with check (current_user_role() = any (array['admin','szulo_admin','vezetoedzo']));

grant select, update on public.club_info to authenticated;
grant select, insert, update, delete on public.club_people to authenticated;
revoke all on public.club_info, public.club_people from anon;
