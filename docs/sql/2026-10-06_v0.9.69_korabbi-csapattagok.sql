-- Pontregiszter v0.9.69: korábbi CSAPAT-eredmény csapattagokkal (Sándor 2026.10.06)
--   - csapateredménynél kötelező megadni a csapattagokat (a felület ellenőrzi)
--   - a csapat-bejegyzés a tagoknál is megjelenik: minden tagnak saját sora van, a sorok
--     közös team_group_id-vel összekötve; a csapatrész (verseny, dátum, csapatnév, helyezés,
--     pont, tagok) a csoport minden során azonos
--   - tag lehet inaktív versenyző is, vagy profil nélküli név (csak a taglistában szerepel)
--   - a régi bejegyzések nem változnak; szerkesztéskor adják meg hozzájuk a tagokat
-- Futtatás: Supabase → SQL Editor → beilleszt → Run. Többször is lefuttatható; meglévő adatot nem módosít.

alter table public.historical_results add column if not exists team_group_id uuid;
alter table public.historical_results add column if not exists team_members jsonb not null default '[]'::jsonb;
create index if not exists historical_results_team_group_idx on public.historical_results (team_group_id);

-- Szerkesztheti-e a belépett felhasználó a versenyző korábbi eredményét
-- (edző/admin, vagy a versenyző maga / a szülője)
create or replace function public.can_edit_history_for(p_competitor uuid) returns boolean
language sql stable security definer set search_path = public as $f$
  select current_user_role() = any (array['admin','szulo_admin','vezetoedzo','edzo','segededzo'])
      or public.can_report_training_for(p_competitor)
$f$;

-- A csoport (csapat) sorainak összehangolása egy forrássorból: a tagoknak létrehozza /
-- frissíti a saját sorukat (csak a csapatrész), a taglistából kikerültekét leválasztja.
create or replace function public.sync_historical_team(p_source uuid) returns uuid
language plpgsql security definer set search_path = public as $f$
declare
  src   historical_results%rowtype;
  grp   uuid;
  m     jsonb;
  mid   uuid;
  ids   uuid[] := '{}';
  team_part jsonb;
  r     historical_results%rowtype;
  rest  jsonb;
begin
  select * into src from historical_results where id = p_source;
  if not found then raise exception 'Nincs ilyen bejegyzés'; end if;
  if not public.can_edit_history_for(src.competitor_id) then
    raise exception 'Ehhez nincs jogosultságod';
  end if;

  grp := coalesce(src.team_group_id, gen_random_uuid());
  update historical_results set team_group_id = grp where id = src.id;

  team_part := jsonb_strip_nulls(jsonb_build_object(
    'csapat', src.results -> 'csapat',
    'team_apparatuses', src.results -> 'team_apparatuses'));

  -- a tagok (profillal) sorai
  for m in select * from jsonb_array_elements(coalesce(src.team_members, '[]'::jsonb)) loop
    mid := nullif(m ->> 'competitor_id', '')::uuid;
    continue when mid is null;
    ids := ids || mid;
    continue when mid = src.competitor_id;

    select * into r from historical_results where team_group_id = grp and competitor_id = mid limit 1;
    if found then
      update historical_results set
        competition_name = src.competition_name, competition_date = src.competition_date, year = src.year,
        importance = src.importance, kategoria = src.kategoria, korosztaly = src.korosztaly,
        team_name = src.team_name, team_members = src.team_members,
        results = (coalesce(r.results, '{}'::jsonb) - 'csapat' - 'team_apparatuses') || team_part,
        modified_by = auth.uid(), modified_at = now()
      where id = r.id;
    else
      insert into historical_results (competitor_id, year, competition_date, competition_name, competition_type,
        importance, kategoria, korosztaly, team_name, notes, results, team_group_id, team_members,
        created_by, modified_by, modified_at)
      values (mid, src.year, src.competition_date, src.competition_name, src.competition_type,
        src.importance, src.kategoria, src.korosztaly, src.team_name, null, team_part, grp, src.team_members,
        auth.uid(), auth.uid(), now());
    end if;
  end loop;

  -- a taglistából kikerültek sorai: csak csapatrész → törlés; különben a csapatrész le
  for r in select * from historical_results
           where team_group_id = grp and id <> src.id and not (competitor_id = any(ids)) loop
    rest := coalesce(r.results, '{}'::jsonb) - 'csapat' - 'team_apparatuses';
    if rest = '{}'::jsonb then
      delete from historical_results where id = r.id;
    else
      update historical_results set results = rest, team_group_id = null, team_members = '[]'::jsonb
      where id = r.id;
    end if;
  end loop;

  return grp;
end $f$;

-- Csatlakozás egy már rögzített csapat-bejegyzéshez (ismétlés helyett): a versenyzőt
-- felveszi a tagok közé, és a csapatsort nála is létrehozza. p_own: a versenyző saját,
-- külön rögzített csapatsora (ha volt) — annak csapatrésze törlődik, hogy ne legyen kétszer.
create or replace function public.join_historical_team(p_match uuid, p_competitor uuid, p_name text, p_own uuid)
returns uuid
language plpgsql security definer set search_path = public as $f$
declare
  mt    historical_results%rowtype;
  own   historical_results%rowtype;
  rest  jsonb;
begin
  if not public.can_edit_history_for(p_competitor) then
    raise exception 'Ehhez nincs jogosultságod';
  end if;
  select * into mt from historical_results where id = p_match;
  if not found then raise exception 'Nincs ilyen bejegyzés'; end if;

  if p_own is not null then
    select * into own from historical_results where id = p_own and competitor_id = p_competitor;
    if found and (own.team_group_id is null or own.team_group_id is distinct from mt.team_group_id) then
      rest := coalesce(own.results, '{}'::jsonb) - 'csapat' - 'team_apparatuses';
      if rest = '{}'::jsonb then
        delete from historical_results where id = own.id;
      else
        update historical_results set results = rest, team_group_id = null, team_members = '[]'::jsonb where id = own.id;
      end if;
    end if;
  end if;

  if not exists (select 1 from jsonb_array_elements(coalesce(mt.team_members, '[]'::jsonb)) e
                 where e ->> 'competitor_id' = p_competitor::text) then
    update historical_results
      set team_members = coalesce(team_members, '[]'::jsonb)
                         || jsonb_build_array(jsonb_build_object('competitor_id', p_competitor, 'name', p_name))
      where id = mt.id;
    -- a csoport többi sorában is ugyanaz a taglista
    if mt.team_group_id is not null then
      update historical_results h set team_members = (select team_members from historical_results where id = mt.id)
      where h.team_group_id = mt.team_group_id;
    end if;
  end if;

  -- a sorok összehangolása a meglévő bejegyzés tulajdonosának jogán belül futó szinkronnal
  return public.sync_historical_team_internal(p_match);
end $f$;

-- A szinkron jogosultság-ellenőrzés nélküli belső változata (csak a fenti függvény hívja)
create or replace function public.sync_historical_team_internal(p_source uuid) returns uuid
language plpgsql security definer set search_path = public as $f$
declare
  src historical_results%rowtype;
  grp uuid;
  m jsonb;
  mid uuid;
  team_part jsonb;
  r historical_results%rowtype;
begin
  select * into src from historical_results where id = p_source;
  grp := coalesce(src.team_group_id, gen_random_uuid());
  update historical_results set team_group_id = grp where id = src.id;
  team_part := jsonb_strip_nulls(jsonb_build_object(
    'csapat', src.results -> 'csapat',
    'team_apparatuses', src.results -> 'team_apparatuses'));
  for m in select * from jsonb_array_elements(coalesce(src.team_members, '[]'::jsonb)) loop
    mid := nullif(m ->> 'competitor_id', '')::uuid;
    continue when mid is null or mid = src.competitor_id;
    select * into r from historical_results where team_group_id = grp and competitor_id = mid limit 1;
    if found then
      update historical_results set team_members = src.team_members,
        results = (coalesce(r.results, '{}'::jsonb) - 'csapat' - 'team_apparatuses') || team_part
      where id = r.id;
    else
      insert into historical_results (competitor_id, year, competition_date, competition_name, competition_type,
        importance, kategoria, korosztaly, team_name, notes, results, team_group_id, team_members,
        created_by, modified_by, modified_at)
      values (mid, src.year, src.competition_date, src.competition_name, src.competition_type,
        src.importance, src.kategoria, src.korosztaly, src.team_name, null, team_part, grp, src.team_members,
        auth.uid(), auth.uid(), now());
    end if;
  end loop;
  return grp;
end $f$;

revoke all on function public.can_edit_history_for(uuid) from public, anon;
grant execute on function public.can_edit_history_for(uuid) to authenticated;
revoke all on function public.sync_historical_team(uuid) from public, anon;
grant execute on function public.sync_historical_team(uuid) to authenticated;
revoke all on function public.join_historical_team(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.join_historical_team(uuid, uuid, text, uuid) to authenticated;
revoke all on function public.sync_historical_team_internal(uuid) from public, anon, authenticated;
