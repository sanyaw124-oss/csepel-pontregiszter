-- Pontregiszter v1.11.0: kabala-szavazás az Áttekintés oldalon (Sándor, 2026.11.01.)
--   - jelölteket képpel az Admin / Szülő-admin / Vezetőedző / Edző kezel
--   - fiókonként EGY szavazat (az adatbázis kényszeríti), utólag nem módosítható
--   - az eredmény csak a saját szavazat után vagy a lezárás után látszik; hogy ki mire szavazott, senki nem látja
-- Futtatás: Supabase → SQL Editor → Run. Többször is lefuttatható; meglévő adatot nem módosít.

-- 1) A szavazás állapota (egyetlen sor): előkészítés → nyitva → lezárva
create table if not exists public.mascot_poll (
  id int primary key default 1 check (id = 1),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  updated_at timestamptz not null default now()
);
insert into public.mascot_poll (id) values (1) on conflict (id) do nothing;

-- 2) A jelöltek
create table if not exists public.mascot_candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text,
  shop_url text,
  photo_path text,
  created_at timestamptz not null default now()
);

-- 3) A szavazatok: a kulcs maga a fiók, így egy fiók csak egyszer szavazhat.
--    Szavazott jelölt nem törölhető (on delete restrict).
create table if not exists public.mascot_votes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  candidate_id uuid not null references public.mascot_candidates (id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.mascot_poll enable row level security;
alter table public.mascot_candidates enable row level security;
alter table public.mascot_votes enable row level security;
-- A mascot_votes táblához szándékosan NINCS szabály: közvetlenül senki nem éri el, csak a lenti függvények.

drop policy if exists mascot_poll_read on public.mascot_poll;
create policy mascot_poll_read on public.mascot_poll for select to authenticated using (true);
drop policy if exists mascot_poll_write on public.mascot_poll;
create policy mascot_poll_write on public.mascot_poll for update to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']))
  with check (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));

drop policy if exists mascot_candidates_read on public.mascot_candidates;
create policy mascot_candidates_read on public.mascot_candidates for select to authenticated using (true);
drop policy if exists mascot_candidates_write on public.mascot_candidates;
create policy mascot_candidates_write on public.mascot_candidates for all to authenticated
  using (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']))
  with check (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));

-- 4) Állapot a felületnek: az eredmény csak saját szavazat után vagy lezárás után jön vissza
create or replace function public.mascot_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_status text;
  v_mine uuid;
  v_total int;
  v_results jsonb := null;
begin
  if auth.uid() is null then raise exception 'Nincs bejelentkezve'; end if;
  select status into v_status from mascot_poll where id = 1;
  select candidate_id into v_mine from mascot_votes where user_id = auth.uid();
  select count(*) into v_total from mascot_votes;
  if v_mine is not null or v_status = 'closed' then
    select coalesce(jsonb_object_agg(candidate_id, n), '{}'::jsonb) into v_results
      from (select candidate_id, count(*) as n from mascot_votes group by candidate_id) t;
  end if;
  return jsonb_build_object('status', v_status, 'my_vote', v_mine, 'total', v_total, 'results', v_results);
end $$;

-- 5) Szavazás: csak nyitott szavazáson, létező jelöltre, fiókonként egyszer
create or replace function public.mascot_vote(p_candidate uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or current_user_role() is null then raise exception 'Nincs jogosultság'; end if;
  if (select status from mascot_poll where id = 1) <> 'open' then
    raise exception 'A szavazás most nincs nyitva.';
  end if;
  if not exists (select 1 from mascot_candidates where id = p_candidate) then
    raise exception 'Ez a jelölt már nem létezik.';
  end if;
  insert into mascot_votes (user_id, candidate_id) values (auth.uid(), p_candidate)
    on conflict (user_id) do nothing;
  if not found then raise exception 'Ezzel a fiókkal már szavaztál.'; end if;
  return mascot_status();
end $$;

-- 6) Szavazatok törlése (próba után): csak a szerkesztőknek, és csak előkészítés állapotban
create or replace function public.mascot_reset()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not (current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo'])) then
    raise exception 'Nincs jogosultság';
  end if;
  if (select status from mascot_poll where id = 1) <> 'draft' then
    raise exception 'Szavazatot törölni csak előkészítés állapotban lehet.';
  end if;
  delete from mascot_votes where true;
  return mascot_status();
end $$;

revoke all on function public.mascot_status() from public, anon;
revoke all on function public.mascot_vote(uuid) from public, anon;
revoke all on function public.mascot_reset() from public, anon;
grant execute on function public.mascot_status() to authenticated;
grant execute on function public.mascot_vote(uuid) to authenticated;
grant execute on function public.mascot_reset() to authenticated;

-- 7) Privát képtárhely: max 3 MB, csak kép; olvasás bejelentkezve, feltöltés / törlés a szerkesztőknek
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mascot-photos', 'mascot-photos', false, 3145728, array['image/jpeg','image/webp','image/png'])
on conflict (id) do nothing;

drop policy if exists "mascot photos read" on storage.objects;
create policy "mascot photos read" on storage.objects
  for select to authenticated using (bucket_id = 'mascot-photos');
drop policy if exists "mascot photos insert" on storage.objects;
create policy "mascot photos insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'mascot-photos'
              and current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));
drop policy if exists "mascot photos delete" on storage.objects;
create policy "mascot photos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'mascot-photos'
         and current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo']));

select 'KÉSZ' as allapot,
       (select status from public.mascot_poll where id = 1) as szavazas,
       (select count(*) from public.mascot_candidates) as jeloltek,
       (select count(*) from storage.buckets where id = 'mascot-photos') as kep_tarhely;
